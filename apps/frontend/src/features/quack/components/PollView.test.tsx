import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import { closePoll, voteOnPoll } from "@/features/quack/api/pollApi"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/pollApi")

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  options: [
    { id: "pizza", text: "Pizza", votes: 2 },
    { id: "sushi", text: "Sushi", votes: 1 },
  ],
  totalVotes: 3,
  myOptionId: null,
  closedAt: null,
  ...overrides,
})

const quack = (pollOverrides: Partial<Poll> = {}): Quack => ({
  id: "q1",
  text: "Where do we go for lunch?",
  mood: null,
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Pond Admin", username: "pondadmin" },
  poll: poll(pollOverrides),
})

// The feed reads from the query cache, like the real page, so the optimistic
// update is visible in the list.
function Feed({ server, currentUserId }: { server: () => Quack[]; currentUserId: string }) {
  const { data } = useQuery({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.resolve(server()),
    staleTime: Infinity,
  })
  return (
    <QuackList
      quacks={data ?? []}
      currentUserId={currentUserId}
    />
  )
}

function renderFeed(server: () => Quack[], currentUserId = "reader") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <Feed
        server={server}
        currentUserId={currentUserId}
      />
    </QueryClientProvider>,
  )
}

// Never settles: the vote stays "in flight" while we look at the screen.
const noop = (): void => undefined

const answer = (name: RegExp | string) => screen.findByRole("button", { name })

beforeEach(() => vi.resetAllMocks())

describe("PollView results", () => {
  it("shows count, percentage, total and my vote", async () => {
    renderFeed(() => [quack({ myOptionId: "sushi" })])

    const pizza = await answer(/Pizza/)
    expect(pizza).toHaveTextContent("2 (67%)")
    expect(pizza).toHaveAttribute("aria-pressed", "false")
    const sushi = await answer(/Sushi/)
    expect(sushi).toHaveTextContent("1 (33%)")
    expect(sushi).toHaveTextContent("Your vote")
    expect(sushi).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("says 'No votes yet' for an empty poll and '1 vote' for a single vote", async () => {
    const { unmount } = renderFeed(() => [
      quack({
        options: [
          { id: "pizza", text: "Pizza", votes: 0 },
          { id: "sushi", text: "Sushi", votes: 0 },
        ],
        totalVotes: 0,
      }),
    ])
    expect(await screen.findByText("No votes yet")).toBeInTheDocument()
    expect(await answer(/Pizza/)).toHaveTextContent("0 (0%)")
    unmount()

    renderFeed(() => [
      quack({
        options: [
          { id: "pizza", text: "Pizza", votes: 1 },
          { id: "sushi", text: "Sushi", votes: 0 },
        ],
        totalVotes: 1,
      }),
    ])
    expect(await screen.findByText("1 vote")).toBeInTheDocument()
  })

  it("locks a closed poll and keeps its final counts", async () => {
    renderFeed(() => [quack({ closedAt: new Date("2026-01-02T00:00:00Z"), myOptionId: "pizza" })])

    expect(await answer(/Pizza/)).toBeDisabled()
    expect(screen.getByText(/Closed/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pizza/ })).toHaveTextContent("2 (67%)")
    expect(screen.queryByRole("button", { name: "Close poll" })).not.toBeInTheDocument()
  })
})

describe("voting", () => {
  it("updates the numbers before the server answers", async () => {
    vi.mocked(voteOnPoll).mockReturnValue(new Promise<Poll>(noop))
    const user = userEvent.setup()
    renderFeed(() => [quack()])

    await user.click(await answer(/Sushi/))

    expect(screen.getByRole("button", { name: /Sushi/ })).toHaveTextContent("2 (50%)")
    expect(screen.getByRole("button", { name: /Sushi/ })).toHaveTextContent("Your vote")
    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })

  it("moves my vote when I pick another answer", async () => {
    vi.mocked(voteOnPoll).mockReturnValue(new Promise<Poll>(noop))
    const user = userEvent.setup()
    renderFeed(() => [quack({ myOptionId: "pizza" })])

    await user.click(await answer(/Sushi/))

    expect(screen.getByRole("button", { name: /Pizza/ })).toHaveTextContent("1 (33%)")
    expect(screen.getByRole("button", { name: /Sushi/ })).toHaveTextContent("2 (67%)")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("does nothing when I pick my own answer again", async () => {
    const user = userEvent.setup()
    renderFeed(() => [quack({ myOptionId: "pizza" })])

    await user.click(await answer(/Pizza/))

    expect(voteOnPoll).not.toHaveBeenCalled()
  })

  it("rolls back and offers Retry when the vote fails", async () => {
    vi.mocked(voteOnPoll).mockRejectedValueOnce(new Error("offline"))
    const user = userEvent.setup()
    renderFeed(() => [quack()])

    await user.click(await answer(/Sushi/))

    expect(await screen.findByText("Your vote didn't go through.")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sushi/ })).toHaveTextContent("1 (33%)"),
    )
    expect(screen.getByRole("button", { name: /Sushi/ })).not.toHaveTextContent("Your vote")

    vi.mocked(voteOnPoll).mockResolvedValueOnce(poll({ myOptionId: "sushi" }))
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(vi.mocked(voteOnPoll).mock.lastCall?.[0]).toEqual({ quackId: "q1", optionId: "sushi" })
    await waitFor(() =>
      expect(screen.queryByText("Your vote didn't go through.")).not.toBeInTheDocument(),
    )
  })

  it("explains when the poll closed before the vote", async () => {
    const conflict = Object.assign(Object.create(HTTPError.prototype) as HTTPError, {
      response: { status: 409 },
    })
    vi.mocked(voteOnPoll).mockRejectedValueOnce(conflict)
    const user = userEvent.setup()
    renderFeed(() => [quack({ closedAt: null })])

    await user.click(await answer(/Sushi/))

    expect(await screen.findByText("This poll closed before your vote.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument()
  })
})

describe("closing", () => {
  it("shows Close poll only to the author", async () => {
    renderFeed(() => [quack()], "reader")
    await answer(/Pizza/)
    expect(screen.queryByRole("button", { name: "Close poll" })).not.toBeInTheDocument()
  })

  it("asks before closing, then closes", async () => {
    vi.mocked(closePoll).mockResolvedValue(poll({ closedAt: new Date() }))
    const user = userEvent.setup()
    renderFeed(() => [quack()], "author")

    await user.click(await screen.findByRole("button", { name: "Close poll" }))
    expect(closePoll).not.toHaveBeenCalled()

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Close poll" }))

    await waitFor(() => expect(closePoll).toHaveBeenCalled())
    expect(vi.mocked(closePoll).mock.calls[0]?.[0]).toBe("q1")
  })

  it("can be cancelled", async () => {
    const user = userEvent.setup()
    renderFeed(() => [quack()], "author")

    await user.click(await screen.findByRole("button", { name: "Close poll" }))
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }),
    )

    expect(closePoll).not.toHaveBeenCalled()
  })
})
