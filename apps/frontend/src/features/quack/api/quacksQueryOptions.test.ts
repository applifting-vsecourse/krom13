import { describe, expect, it } from "vitest"

import { FEED_REFRESH_MS, quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"

describe("quacksQueryOptions refresh", () => {
  it("refreshes the feed every 10 seconds", () => {
    expect(FEED_REFRESH_MS).toBe(10_000)
    expect(quacksQueryOptions("").refetchInterval).toBe(10_000)
  })

  it("stops refreshing while a vote is in flight", () => {
    expect(quacksQueryOptions("", { isAutoRefresh: false }).refetchInterval).toBe(false)
  })
})

describe("quacksQueryOptions tab", () => {
  it("keeps All and Mine in separate cache entries", () => {
    expect(quacksQueryOptions("", { tab: "mine" }).queryKey).not.toEqual(
      quacksQueryOptions("").queryKey,
    )
  })
})
