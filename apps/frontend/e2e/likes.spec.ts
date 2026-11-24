// End-to-end flows for likes (cases.md, section 3). Each test posts its own
// quack, so it does not depend on what the seed contains.
import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const APP = "http://localhost:3050"
const API = "http://localhost:4050/api"

const ANN = { email: "caffeinatedduck@example.com", password: "password1" }
const BOB = { email: "deepduckthoughts@example.com", password: "password2" }

async function postQuack(page: Page, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function postReply(page: Page, quackId: string, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks/${quackId}/replies`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

const heartOn = (page: Page, text: string) =>
  page.getByRole("article").filter({ hasText: text }).getByRole("button", { name: /^like/i })

async function secondUser(browser: import("@playwright/test").Browser) {
  const page = await browser.newPage({ baseURL: APP })
  await signIn(page, BOB.email, BOB.password)
  return page
}

// E1 — the product owner's examples: 0 → 1, then 1 → 0.
test("E1: I like a quack and take the like back", async ({ page }) => {
  const text = `E2E like ${Date.now()}`
  await signIn(page, ANN.email, ANN.password)
  await postQuack(page, text)
  await page.goto("/quacks")

  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "false")
  await expect(heartOn(page, text)).toHaveText(/0/)

  await heartOn(page, text).click()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(page, text)).toHaveText(/1/)
  await page.reload()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(page, text)).toHaveText(/1/)

  await heartOn(page, text).click()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "false")
  await expect(heartOn(page, text)).toHaveText(/0/)
  await page.reload()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "false")
  await expect(heartOn(page, text)).toHaveText(/0/)
})

// E2
test("E2: likes are shared between people", async ({ page, browser }) => {
  const text = `E2E shared like ${Date.now()}`
  await signIn(page, ANN.email, ANN.password)
  await postQuack(page, text)
  await page.goto("/quacks")
  await heartOn(page, text).click()
  await expect(heartOn(page, text)).toHaveText(/1/)

  const bob = await secondUser(browser)
  await bob.goto("/quacks")
  await expect(heartOn(bob, text)).toHaveAttribute("aria-pressed", "false")
  await expect(heartOn(bob, text)).toHaveText(/1/)
  await heartOn(bob, text).click()
  await expect(heartOn(bob, text)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(bob, text)).toHaveText(/2/)

  await page.reload()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(page, text)).toHaveText(/2/)
  await bob.close()
})

// E3 — GUARD-RAIL, passes today. cases.md pictured a signed-out visitor seeing
// the count next to a disabled heart. Today every quack page is behind sign-in,
// so the visitor is sent to the login page and sees no likes at all.
test("E3: a signed-out visitor is sent to sign in and sees no like buttons", async ({ page }) => {
  await page.goto("/quacks")

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("button", { name: /^like/i })).toHaveCount(0)
})

// E4
test("E4: a reply can be liked on its own", async ({ page }) => {
  const stamp = Date.now()
  const quackText = `E2E quack for reply likes ${stamp}`
  const replyText = `E2E reply ${stamp}`
  await signIn(page, ANN.email, ANN.password)
  const quackId = await postQuack(page, quackText)
  await postReply(page, quackId, replyText)
  await page.goto(`/quacks/${quackId}`)

  await heartOn(page, replyText).click()

  await expect(heartOn(page, replyText)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(page, replyText)).toHaveText(/1/)
  await expect(heartOn(page, quackText)).toHaveText(/0/)
})

// E5
test("E5: a failed like rolls back, then Retry works", async ({ page }) => {
  const text = `E2E failing like ${Date.now()}`
  await signIn(page, ANN.email, ANN.password)
  await postQuack(page, text)
  await page.goto("/quacks")
  await page.route("**/api/quacks/*/like", (route) => route.fulfill({ status: 500 }))

  await heartOn(page, text).click()

  await expect(page.getByText("Your like didn't go through.")).toBeVisible()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "false")
  await expect(heartOn(page, text)).toHaveText(/0/)

  await page.unroute("**/api/quacks/*/like")
  await page.getByRole("button", { name: "Retry" }).click()
  await expect(heartOn(page, text)).toHaveAttribute("aria-pressed", "true")
  await expect(heartOn(page, text)).toHaveText(/1/)
})

// E6
test("E6: a deleted quack with replies loses its likes; the reply keeps its own", async ({
  page,
  browser,
}) => {
  const stamp = Date.now()
  const quackText = `E2E deleted liked quack ${stamp}`
  const replyText = `E2E surviving reply ${stamp}`
  await signIn(page, ANN.email, ANN.password)
  const quackId = await postQuack(page, quackText)
  await page.goto(`/quacks/${quackId}`)
  await heartOn(page, quackText).click()
  await expect(heartOn(page, quackText)).toHaveText(/1/)

  const bob = await secondUser(browser)
  const replyId = await postReply(bob, quackId, replyText)
  await bob.request.post(`${API}/quacks/${replyId}/like`)
  await bob.close()

  await page.reload()
  await page.getByRole("button", { name: "Delete quack" }).first().click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  const placeholder = page.getByText("This quack was deleted.").locator("xpath=ancestor::article")
  await expect(placeholder).toBeVisible()
  await expect(placeholder.getByRole("button", { name: /^like/i })).toHaveCount(0)
  await expect(heartOn(page, replyText)).toHaveText(/1/)
})
