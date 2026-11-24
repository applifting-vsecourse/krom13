// Tests for likes (cases.md, section 1 "Rules": R11–R18). The server call is
// mocked; the feed reads from the query cache like the real page, so the
// instant update is visible on screen.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { toggleLike, type LikeResult } from "@/features/quack/api/likeApi"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Thread, ThreadItem } from "@/features/quack/api/quackSchemas"
import { LikeButton } from "@/features/quack/components/LikeButton"
import { ThreadView } from "@/features/quack/components/ThreadView"

vi.mock("@/features/quack/api/likeApi")
vi.mock("@/features/quack/api/addReply")
vi.mock("@/features/quack/api/deleteQuack")

// What the server sends per quack, as far as likes go.
type Row = { id: string; likeCount: number; likedByMe: boolean }

function Feed({ server }: { server: () => Row[] }) {
  const { data } = useQuery({
    queryKey: quackKeys.list(""),
    queryFn: () => Promise.resolve(server()),
    staleTime: Infinity,
  })
  return (
    <>
      {(data ?? []).map((row) => (
        <LikeButton
          key={row.id}
          quackId={row.id}
          likeCount={row.likeCount}
          likedByMe={row.likedByMe}
        />
      ))}
    </>
  )
}

function renderFeed(rows: Row[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  const view = render(
    <QueryClientProvider client={client}>
      <Feed server={() => rows} />
    </QueryClientProvider>,
  )
  return { client, ...view }
}

// Never settles: the like stays "in flight" while we look at the screen.
const noop = (): void => undefined

const heart = () => screen.findByRole("button", { name: /like/i })

beforeEach(() => vi.resetAllMocks())

describe("like button display", () => {
  // R11
  it("shows 0, not a blank, for a quack nobody liked", async () => {
    renderFeed([{ id: "q1", likeCount: 0, likedByMe: false }])

    expect(await heart()).toHaveTextContent("0")
  })

  // R12
  it("shows a pressed button and the count when I liked it", async () => {
    renderFeed([{ id: "q1", likeCount: 3, likedByMe: true }])

    const button = await heart()
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("3")
  })

  // R13
  it("shows an unpressed button when I did not like it", async () => {
    renderFeed([{ id: "q1", likeCount: 3, likedByMe: false }])

    const button = await heart()
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveTextContent("3")
  })
})

describe("liking", () => {
  // R15
  it("flips at once and ignores more clicks until the server answers", async () => {
    vi.mocked(toggleLike).mockReturnValue(new Promise<LikeResult>(noop))
    const user = userEvent.setup()
    renderFeed([{ id: "q1", likeCount: 0, likedByMe: false }])

    await user.click(await heart())

    const button = screen.getByRole("button", { name: /like/i })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("1")
    await user.click(button)
    await user.click(button)
    expect(toggleLike).toHaveBeenCalledTimes(1)
    expect(toggleLike).toHaveBeenCalledWith("q1")
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("1")
  })

  it("takes my like back at once: 1 → 0", async () => {
    vi.mocked(toggleLike).mockReturnValue(new Promise<LikeResult>(noop))
    const user = userEvent.setup()
    renderFeed([{ id: "q1", likeCount: 1, likedByMe: true }])

    await user.click(await heart())

    const button = screen.getByRole("button", { name: /like/i })
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveTextContent("0")
  })

  // R16
  it("rolls back, shows an error and Retry next to that quack, and Retry asks again", async () => {
    vi.mocked(toggleLike).mockRejectedValueOnce(new Error("offline"))
    const user = userEvent.setup()
    renderFeed([{ id: "q1", likeCount: 0, likedByMe: false }])

    await user.click(await heart())

    expect(await screen.findByText("Your like didn't go through.")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /like/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    )
    expect(screen.getByRole("button", { name: /like/i })).toHaveTextContent("0")

    vi.mocked(toggleLike).mockResolvedValueOnce({ liked: true, likeCount: 1 })
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(toggleLike).toHaveBeenCalledTimes(2)
    expect(vi.mocked(toggleLike).mock.lastCall?.[0]).toBe("q1")
    await waitFor(() =>
      expect(screen.queryByText("Your like didn't go through.")).not.toBeInTheDocument(),
    )
  })

  // R17 — the feed pauses its 10-second refresh while a mutation with this
  // key is running (the same way it does for votes), so the key must be
  // registered exactly while a like is in flight.
  it("registers a like mutation while the request is in flight, and clears it after", async () => {
    let finish: (result: LikeResult) => void = noop
    vi.mocked(toggleLike).mockReturnValue(
      new Promise<LikeResult>((resolve) => {
        finish = resolve
      }),
    )
    const user = userEvent.setup()
    const { client } = renderFeed([{ id: "q1", likeCount: 0, likedByMe: false }])

    await user.click(await heart())
    expect(client.isMutating({ mutationKey: quackKeys.like() })).toBe(1)

    finish({ liked: true, likeCount: 1 })
    await waitFor(() => expect(client.isMutating({ mutationKey: quackKeys.like() })).toBe(0))
  })
})

describe("emptied quacks", () => {
  const live = (id: string, username: string, overrides: Partial<ThreadItem> = {}): ThreadItem =>
    Object.assign(
      {
        id,
        deleted: false,
        text: `text of ${id}`,
        mood: null,
        userId: username,
        user: { id: username, name: `Name ${username}`, username },
        parentId: null,
        inReplyTo: null,
        createdAt: new Date("2026-01-01T12:00:00Z"),
        poll: null,
      },
      overrides,
      { likeCount: 2, likedByMe: false },
    )

  const emptied = (id: string): ThreadItem =>
    Object.assign(
      {
        id,
        deleted: true,
        text: "",
        mood: null,
        userId: null,
        user: null,
        parentId: "root",
        inReplyTo: null,
        createdAt: new Date("2026-01-01T12:00:00Z"),
        poll: null,
      },
      { likeCount: 0, likedByMe: false },
    )

  // R18
  it("has no like button or count on the placeholder, but live quacks and replies do", () => {
    const thread: Thread = {
      quack: live("root", "ann"),
      replyCount: 1,
      replies: [emptied("r0"), live("r1", "bob", { parentId: "r0" })],
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
    render(
      <QueryClientProvider client={client}>
        <ThreadView
          thread={thread}
          currentUserId="me"
          isModerator={false}
        />
      </QueryClientProvider>,
    )

    // The quack and the live reply each get one.
    expect(screen.getAllByRole("button", { name: /like/i })).toHaveLength(2)
    const placeholder = screen.getByText("This quack was deleted.").closest("article")!
    expect(within(placeholder).queryByRole("button")).not.toBeInTheDocument()
    expect(placeholder).not.toHaveTextContent(/\d/)
  })
})
