import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SettingsForm } from "@/features/auth/components/SettingsForm"
import { authClient } from "@/features/auth/lib/auth-client"

vi.mock("@/features/auth/lib/auth-client", () => ({
  authClient: { updateUser: vi.fn() },
}))

const updateUser = vi.mocked(authClient.updateUser)

const saved = { username: "duck", name: "Duck", bio: "", defaultMood: undefined }

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SettingsForm saved={saved} />
    </QueryClientProvider>,
  )
}

describe("SettingsForm", () => {
  beforeEach(() => updateUser.mockReset())

  it("starts with the saved values", () => {
    renderForm()
    expect(screen.getByLabelText("Username")).toHaveValue("duck")
    expect(screen.getByLabelText("Display name")).toHaveValue("Duck")
  })

  it("rejects an invalid username without calling the server", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "a b")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(/only letters, numbers, dots and underscores/i)).toBeVisible()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("requires a display name and limits the bio to 160 characters", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.clear(screen.getByLabelText("Display name"))
    await user.click(screen.getByLabelText("Bio (optional)"))
    await user.paste("a".repeat(161))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Display name is required")).toBeVisible()
    expect(screen.getByText("Keep it under 160 characters")).toBeVisible()
  })

  it("shows a taken username next to the field and keeps what was typed", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { code: "USERNAME_IS_ALREADY_TAKEN", message: "taken", status: 400, statusText: "" },
    })
    const user = userEvent.setup()
    renderForm()
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "mallard")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("That username is already taken")).toBeVisible()
    expect(screen.getByLabelText("Username")).toHaveValue("mallard")
  })

  it("confirms a save, and discard goes back to the saved values", async () => {
    updateUser.mockResolvedValue({ data: { status: true }, error: null })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText("Bio (optional)"), "hello")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Settings saved")).toBeVisible()

    await user.type(screen.getByLabelText("Display name"), " Jr")
    await user.click(screen.getByRole("button", { name: "Discard changes" }))
    await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveValue("Duck"))
  })
})
