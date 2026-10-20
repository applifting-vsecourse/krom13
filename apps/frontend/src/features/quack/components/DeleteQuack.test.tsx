import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/deleteQuack")

const quack = (id: string, userId: string, overrides: Partial<Quack> = {}): Quack => ({
  id,
  text: `text of ${id}`,
  mood: null,
  userId,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: userId, name: `Name ${userId}`, username: userId },
  poll: null,
  ...overrides,
})

// Reads from the query cache like the real page, so the refetch after a
// delete is what removes the quack from the screen.
function Feed({ server }: { server: () => Quack[] }) {
  const { data } = useQuery({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.resolve(server()),
    staleTime: Infinity,
  })
  return (
    <QuackList
      quacks={data ?? []}
      currentUserId="me"
    />
  )
}

function renderFeed(server: () => Quack[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <Feed server={server} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe("deleting a quack", () => {
  it("offers Delete on my quacks only", async () => {
    renderFeed(() => [quack("mine", "me"), quack("theirs", "other")])

    await screen.findByText("text of theirs")
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1)
  })

  it("asks first, then removes the quack from the feed", async () => {
    let quacks = [quack("mine", "me"), quack("theirs", "other")]
    vi.mocked(deleteQuack).mockImplementation(() => {
      quacks = quacks.filter((q) => q.id !== "mine")
      return Promise.resolve()
    })
    renderFeed(() => quacks)

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    expect(deleteQuack).not.toHaveBeenCalled()
    expect(screen.getByText("Delete this quack?")).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!)

    await waitFor(() => expect(screen.queryByText("text of mine")).not.toBeInTheDocument())
    expect(deleteQuack).toHaveBeenCalledWith("mine", expect.anything())
    expect(screen.getByText("text of theirs")).toBeInTheDocument()
  })

  it("keeps the quack when I cancel", async () => {
    renderFeed(() => [quack("mine", "me")])

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(deleteQuack).not.toHaveBeenCalled()
    expect(screen.getByText("text of mine")).toBeInTheDocument()
  })

  it("says the votes go too when the quack has a poll", async () => {
    renderFeed(() => [
      quack("mine", "me", {
        poll: {
          options: [
            { id: "a", text: "A", votes: 0 },
            { id: "b", text: "B", votes: 0 },
          ],
          totalVotes: 0,
          myOptionId: null,
          closedAt: null,
        },
      }),
    ])

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))

    expect(screen.getByText(/its poll and everyone's votes/)).toBeInTheDocument()
  })

  it("shows the failure in the dialog and keeps the quack", async () => {
    vi.mocked(deleteQuack).mockRejectedValue(new Error("Server unreachable"))
    renderFeed(() => [quack("mine", "me")])

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!)

    expect(await screen.findByText("Server unreachable")).toBeInTheDocument()
    expect(screen.getByText("text of mine")).toBeInTheDocument()
  })
})

describe("deleteQuack api", () => {
  it("treats a quack that is already gone as deleted", async () => {
    const actual = await vi.importActual<{ deleteQuack: (id: string) => Promise<void> }>(
      "@/features/quack/api/deleteQuack",
    )
    const notFound = Object.assign(Object.create(HTTPError.prototype) as HTTPError, {
      response: { status: 404 },
    })
    const { api } = await import("@/lib/api-client")
    vi.spyOn(api, "delete").mockRejectedValue(notFound)

    await expect(actual.deleteQuack("gone")).resolves.toBeUndefined()
  })
})
