import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

export async function voteOnPoll(input: { quackId: string; optionId: string }): Promise<Poll> {
  const json = await api
    .put(`quacks/${input.quackId}/vote`, { json: { optionId: input.optionId } })
    .json()
  return pollSchema.parse(json)
}

export async function closePoll(quackId: string): Promise<Poll> {
  return pollSchema.parse(await api.post(`quacks/${quackId}/poll/close`).json())
}
