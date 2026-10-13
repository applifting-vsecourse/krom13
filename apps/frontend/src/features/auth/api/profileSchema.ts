import { z } from "zod"

import { moodSchema } from "@/lib/moods"

export const MAX_NAME_LENGTH = 50
export const MAX_BIO_LENGTH = 160

// Mirrors the server rules (username plugin + update-user hook); the server
// still validates independently.
export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_.]+$/, "Use only letters, numbers, dots and underscores"),
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(MAX_NAME_LENGTH, `Keep it under ${MAX_NAME_LENGTH} characters`),
  bio: z.string().max(MAX_BIO_LENGTH, `Keep it under ${MAX_BIO_LENGTH} characters`),
  defaultMood: moodSchema.optional(),
})

export type ProfileValues = z.infer<typeof profileSchema>
