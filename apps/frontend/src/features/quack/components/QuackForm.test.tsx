import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack")

function renderForm(defaultMood?: "happy") {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <QuackForm defaultMood={defaultMood} />
    </QueryClientProvider>,
  )
}

const answers = () => screen.queryAllByLabelText(/^Answer \d$/)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(addQuack).mockResolvedValue({} as never)
})

describe("QuackForm poll", () => {
  it("has no answer fields until 'Add poll' is on", async () => {
    const user = userEvent.setup()
    renderForm()
    expect(answers()).toHaveLength(0)

    await user.click(screen.getByRole("button", { name: "Add poll" }))
    expect(answers()).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "Add poll" }))
    expect(answers()).toHaveLength(0)
  })

  it("allows 2 to 6 answers", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole("button", { name: "Add poll" }))

    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Add answer" }))
    expect(answers()).toHaveLength(6)
    expect(screen.getByRole("button", { name: "Add answer" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Remove answer 6" }))
    expect(answers()).toHaveLength(5)
    // the first two can't be removed
    expect(screen.queryByRole("button", { name: "Remove answer 1" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove answer 2" })).not.toBeInTheDocument()
  })

  it("rejects an empty answer", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("New quack"), "Lunch?")
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.type(screen.getByLabelText("Answer 1"), "Pizza")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Write an answer or remove this one")).toBeVisible()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("rejects two answers that match ignoring case and spaces", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("New quack"), "Lunch?")
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.type(screen.getByLabelText("Answer 1"), "Pizza")
    await user.type(screen.getByLabelText("Answer 2"), "  pizza ")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Answers must be different")).toBeVisible()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("rejects an answer over 80 characters", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("New quack"), "Lunch?")
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.click(screen.getByLabelText("Answer 1"))
    await user.paste("x".repeat(81))
    await user.type(screen.getByLabelText("Answer 2"), "Sushi")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Keep it under 80 characters")).toBeVisible()
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("posts the trimmed answers with the question", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("New quack"), "Lunch?")
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.type(screen.getByLabelText("Answer 1"), "  Pizza ")
    await user.type(screen.getByLabelText("Answer 2"), "Sushi")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({
      text: "Lunch?",
      mood: undefined,
      poll: { options: ["Pizza", "Sushi"] },
    })
  })

  it("posts a normal quack when the poll is switched off again", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("New quack"), "Just a thought")
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.click(screen.getByRole("button", { name: "Add poll" }))
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalled())
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({
      text: "Just a thought",
      mood: undefined,
      poll: undefined,
    })
  })
})

describe("QuackForm mood", () => {
  it("starts with the default mood selected", () => {
    renderForm("happy")
    expect(screen.getByRole("radio", { name: "happy" })).toBeChecked()
  })

  it.each(["happy", "silly"])(
    "clearing %s leaves no mood selected instead of falling back to the default",
    async (mood) => {
      const user = userEvent.setup()
      renderForm("happy")
      if (mood !== "happy") await user.click(screen.getByRole("radio", { name: mood }))

      await user.click(screen.getByRole("radio", { name: mood }))

      for (const name of ["happy", "sad", "angry", "silly"]) {
        expect(screen.getByRole("radio", { name })).not.toBeChecked()
      }
      await user.type(screen.getByLabelText("New quack"), "hi")
      await user.click(screen.getByRole("button", { name: "Quack" }))
      await waitFor(() => expect(addQuack).toHaveBeenCalled())
      expect(vi.mocked(addQuack).mock.calls[0]?.[0].mood).toBeUndefined()
    },
  )
})
