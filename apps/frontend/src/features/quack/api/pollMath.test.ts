import { describe, expect, it } from "vitest"

import { applyVote, percentOf } from "@/features/quack/api/pollMath"
import type { Poll } from "@/features/quack/api/quackSchemas"

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  options: [
    { id: "a", text: "Pizza", votes: 2 },
    { id: "b", text: "Sushi", votes: 1 },
  ],
  totalVotes: 3,
  myOptionId: null,
  closedAt: null,
  ...overrides,
})

describe("applyVote", () => {
  it("adds a first vote", () => {
    const next = applyVote(poll(), "b")
    expect(next.options.map((o) => o.votes)).toEqual([2, 2])
    expect(next.totalVotes).toBe(4)
    expect(next.myOptionId).toBe("b")
  })

  it("moves a vote without changing the total", () => {
    const next = applyVote(poll({ myOptionId: "a" }), "b")
    expect(next.options.map((o) => o.votes)).toEqual([1, 2])
    expect(next.totalVotes).toBe(3)
    expect(next.myOptionId).toBe("b")
  })

  it("does nothing when the same answer is picked again", () => {
    const before = poll({ myOptionId: "a" })
    expect(applyVote(before, "a")).toBe(before)
  })
})

describe("percentOf", () => {
  it("is 0 for an empty poll", () => {
    expect(percentOf(0, 0)).toBe(0)
  })

  it("rounds to a whole number", () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(1, 1)).toBe(100)
  })
})
