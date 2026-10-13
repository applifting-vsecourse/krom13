import { z } from "zod"

// Shared by the quack form and the settings page (features can't import each
// other), so the emoji map lives next to the zod schema here.
export const MOODS = ["happy", "sad", "angry", "silly"] as const
export const MOOD_EMOJI = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  silly: "🤪",
} as const satisfies Record<(typeof MOODS)[number], string>

export const moodSchema = z.enum(MOODS)
export type Mood = z.infer<typeof moodSchema>
