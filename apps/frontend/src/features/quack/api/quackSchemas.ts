import { z } from "zod"

import { moodSchema } from "@/lib/moods"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const pollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  votes: z.number(),
})

export const pollSchema = z.object({
  options: z.array(pollOptionSchema),
  totalVotes: z.number(),
  // The signed-in user's answer, or null before they vote.
  myOptionId: z.string().nullable(),
  closedAt: z.coerce.date().nullable(),
})

export type Poll = z.infer<typeof pollSchema>

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: moodSchema.nullable(),
  userId: z.string(),
  // Live replies in the thread, counted by the server on every read.
  replyCount: z.number(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>

// One row of a thread page: the top-level quack or a reply. An emptied row
// (deleted: true) has no text, author, mood or poll.
export const threadItemSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
  text: z.string(),
  mood: moodSchema.nullable(),
  userId: z.string().nullable(),
  user: quackUserSchema.nullable(),
  parentId: z.string().nullable(),
  // Only on a reply to another reply, not to the top-level quack.
  inReplyTo: z.object({ deleted: z.boolean(), username: z.string().nullable() }).nullable(),
  createdAt: z.coerce.date(),
  poll: pollSchema.nullable(),
})

export const threadSchema = z.object({
  quack: threadItemSchema,
  replyCount: z.number(),
  // Oldest first, flat.
  replies: z.array(threadItemSchema),
})

export type ThreadItem = z.infer<typeof threadItemSchema>
export type Thread = z.infer<typeof threadSchema>
