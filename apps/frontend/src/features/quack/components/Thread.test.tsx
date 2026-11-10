import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addReply } from "@/features/quack/api/addReply"
import type { Thread, ThreadItem } from "@/features/quack/api/quackSchemas"
import { ThreadView } from "@/features/quack/components/ThreadView"

vi.mock("@/features/quack/api/addReply")
vi.mock("@/features/quack/api/deleteQuack")

const item = (id: string, username: string, overrides: Partial<ThreadItem> = {}): ThreadItem => ({
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
  ...overrides,
})

const deleted = (id: string, overrides: Partial<ThreadItem> = {}): ThreadItem =>
  item(id, "x", { deleted: true, text: "", userId: null, user: null, ...overrides })

const thread = (overrides: Partial<Thread> = {}): Thread => ({
  quack: item("root", "ann"),
  replyCount: 0,
  replies: [],
  ...overrides,
})

function renderThread(value: Thread, currentUserId = "me", isModerator = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <ThreadView
        thread={value}
        currentUserId={currentUserId}
        isModerator={isModerator}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe("thread page", () => {
  it("shows the quack, then its replies in the order given", () => {
    renderThread(
      thread({
        replyCount: 2,
        replies: [item("r1", "bob", { parentId: "root" }), item("r2", "cy", { parentId: "root" })],
      }),
    )

    const texts = screen.getAllByText(/^text of /).map((node) => node.textContent)
    expect(texts).toEqual(["text of root", "text of r1", "text of r2"])
  })

  it("says so when there are no replies", () => {
    renderThread(thread())
    expect(screen.getByText("No replies yet. Be the first.")).toBeInTheDocument()
  })

  it("labels a reply to another reply, and a reply to a deleted one", () => {
    renderThread(
      thread({
        replies: [
          item("r1", "bob", { parentId: "root" }),
          item("r2", "cy", {
            parentId: "r1",
            inReplyTo: { deleted: false, username: "bob" },
          }),
          item("r3", "di", {
            parentId: "r0",
            inReplyTo: { deleted: true, username: null },
          }),
        ],
      }),
    )

    expect(screen.getByText("in reply to @bob")).toBeInTheDocument()
    expect(screen.getByText("in reply to a deleted quack")).toBeInTheDocument()
  })

  it("shows a placeholder for a deleted quack, keeps its replies, offers no reply form", () => {
    renderThread(
      thread({
        quack: deleted("root"),
        replies: [item("r1", "bob", { parentId: "root" })],
      }),
    )

    expect(screen.getByText("This quack was deleted.")).toBeInTheDocument()
    expect(screen.getByText("text of r1")).toBeInTheDocument()
    expect(screen.queryByLabelText("Your reply")).not.toBeInTheDocument()
    // nothing is left to name the author or reply to
    expect(screen.queryByText(/@ann/)).not.toBeInTheDocument()
  })

  it("posts a reply to the top-level quack and clears the form", async () => {
    vi.mocked(addReply).mockResolvedValue(item("new", "me"))
    renderThread(thread())

    await userEvent.type(screen.getByLabelText("Your reply"), "Nice one")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(addReply).toHaveBeenCalledWith({ quackId: "root", text: "Nice one" }, expect.anything())
    expect(screen.getByLabelText("Your reply")).toHaveValue("")
  })

  it("replies to a reply when I use its Reply button", async () => {
    vi.mocked(addReply).mockResolvedValue(item("new", "me"))
    renderThread(thread({ replies: [item("r1", "bob", { parentId: "root" })] }))

    await userEvent.click(screen.getByRole("button", { name: "Reply to @bob" }))
    expect(screen.getByText("Replying to @bob")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Your reply"), "Agreed")
    await userEvent.click(screen.getAllByRole("button", { name: "Reply" }).at(-1)!)

    expect(addReply).toHaveBeenCalledWith({ quackId: "r1", text: "Agreed" }, expect.anything())
  })

  it("opens the form right under the reply I answer, above the next one", async () => {
    renderThread(
      thread({
        replies: [item("r1", "bob", { parentId: "root" }), item("r2", "cy", { parentId: "root" })],
      }),
    )

    await userEvent.click(screen.getByRole("button", { name: "Reply to @bob" }))

    const forms = screen.getAllByLabelText("Your reply")
    expect(forms).toHaveLength(1)
    const [form] = forms
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(screen.getByText("text of r1"), form!)).toBe(true)
    expect(follows(form!, screen.getByText("text of r2"))).toBe(true)
    expect(form).toHaveFocus()
  })

  it("puts the form back at the bottom when I cancel", async () => {
    renderThread(
      thread({
        replies: [item("r1", "bob", { parentId: "root" }), item("r2", "cy", { parentId: "root" })],
      }),
    )

    await userEvent.click(screen.getByRole("button", { name: "Reply to @bob" }))
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))

    const [form] = screen.getAllByLabelText("Your reply")
    expect(
      Boolean(
        screen.getByText("text of r2").compareDocumentPosition(form!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true)
    expect(screen.queryByText("Replying to @bob")).not.toBeInTheDocument()
  })

  it("keeps my text and shows the error when posting fails", async () => {
    vi.mocked(addReply).mockRejectedValue(new Error("Server unreachable"))
    renderThread(thread())

    await userEvent.type(screen.getByLabelText("Your reply"), "Nice one")
    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("Server unreachable")).toBeInTheDocument()
    expect(screen.getByLabelText("Your reply")).toHaveValue("Nice one")
  })

  it("asks for text before posting", async () => {
    renderThread(thread())

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(addReply).not.toHaveBeenCalled()
  })

  it("has no poll fields in the reply form", () => {
    renderThread(thread())
    expect(screen.queryByRole("button", { name: "Add poll" })).not.toBeInTheDocument()
  })

  it("says how many replies stay when I delete a quack that has them", async () => {
    renderThread(
      thread({
        quack: item("root", "me"),
        replies: [item("r1", "bob", { parentId: "root" }), item("r2", "cy", { parentId: "root" })],
      }),
    )

    const [deleteRoot] = screen.getAllByRole("button", { name: "Delete quack" })
    await userEvent.click(deleteRoot!)

    expect(
      within(screen.getByRole("dialog")).getByText(/2 replies stay under a deleted-quack/),
    ).toBeInTheDocument()
  })

  describe("conversations", () => {
    const replies = [
      item("r1", "bob", { parentId: "root" }),
      item("r2", "cy", { parentId: "root" }),
      item("r3", "di", { parentId: "r1", inReplyTo: { deleted: false, username: "bob" } }),
      // a reply to a reply to a reply stays in the same conversation, not deeper
      item("r4", "ed", { parentId: "r3", inReplyTo: { deleted: false, username: "di" } }),
    ]

    it("puts answers to a reply in an indented group under it", () => {
      renderThread(thread({ replies }))

      const group = screen.getByRole("group", { name: "Replies to @bob" })
      expect(within(group).getByText("text of r3")).toBeInTheDocument()
      expect(within(group).getByText("text of r4")).toBeInTheDocument()
      expect(within(group).queryByText("text of r2")).not.toBeInTheDocument()
      expect(screen.getAllByRole("group")).toHaveLength(1)
    })

    it("hides and shows a conversation", async () => {
      renderThread(thread({ replies }))

      await userEvent.click(screen.getByRole("button", { name: "Hide 2 replies" }))
      expect(screen.queryByText("text of r3")).not.toBeInTheDocument()
      expect(screen.getByText("text of r1")).toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: "Show 2 replies" }))
      expect(screen.getByText("text of r3")).toBeInTheDocument()
    })

    it("keeps the answers under a deleted reply", () => {
      renderThread(
        thread({
          replies: [
            deleted("r1", { parentId: "root" }),
            item("r2", "cy", { parentId: "r1", inReplyTo: { deleted: true, username: null } }),
          ],
        }),
      )

      const group = screen.getByRole("group", { name: "Replies to a deleted quack" })
      expect(within(group).getByText("text of r2")).toBeInTheDocument()
      expect(screen.getByText("This quack was deleted.")).toBeInTheDocument()
    })
  })
})
