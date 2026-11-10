import { api } from "@/lib/api-client"
import type { Mood } from "@/lib/moods"

import { threadItemSchema, type ThreadItem } from "@/features/quack/api/quackSchemas"

/** `quackId` is the quack or reply being answered. */
export async function addReply(input: {
  quackId: string
  text: string
  mood?: Mood
}): Promise<ThreadItem> {
  const { quackId, ...body } = input
  const json = await api.post(`quacks/${quackId}/replies`, { json: body }).json()
  return threadItemSchema.parse(json)
}
