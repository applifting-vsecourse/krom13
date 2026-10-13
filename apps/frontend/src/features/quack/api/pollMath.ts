import type { Poll } from "@/features/quack/api/quackSchemas"

// What the poll looks like right after I pick `optionId`, before the server
// answers. The server's numbers replace this as soon as they arrive.
export function applyVote(poll: Poll, optionId: string): Poll {
  if (poll.myOptionId === optionId) return poll
  return {
    ...poll,
    options: poll.options.map((option) => {
      if (option.id === optionId) return { ...option, votes: option.votes + 1 }
      if (option.id === poll.myOptionId) return { ...option, votes: option.votes - 1 }
      return option
    }),
    totalVotes: poll.myOptionId === null ? poll.totalVotes + 1 : poll.totalVotes,
    myOptionId: optionId,
  }
}

// Rounded independently, so the percentages can add up to 99 or 101.
export function percentOf(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100)
}
