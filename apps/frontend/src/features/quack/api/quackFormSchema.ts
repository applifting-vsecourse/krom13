import { z } from "zod"

import { moodSchema } from "@/lib/moods"

// Mirror the server-side DTOs so people are told before the request is made;
// the server still validates independently.
export const MAX_LENGTH = 280
export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 6
export const POLL_OPTION_MAX_LENGTH = 80

export const quackFormSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Write something first")
      .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
    mood: moodSchema.optional(),
    isPoll: z.boolean(),
    options: z.array(z.object({ text: z.string() })).max(MAX_POLL_OPTIONS),
  })
  .superRefine((values, ctx) => {
    if (!values.isPoll) return
    const seen = new Set<string>()
    values.options.forEach((option, index) => {
      const text = option.text.trim()
      const path = ["options", index, "text"]
      if (text === "") {
        ctx.addIssue({ code: "custom", path, message: "Write an answer or remove this one" })
      } else if (text.length > POLL_OPTION_MAX_LENGTH) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `Keep it under ${POLL_OPTION_MAX_LENGTH} characters`,
        })
      } else if (seen.has(text.toLowerCase())) {
        ctx.addIssue({ code: "custom", path, message: "Answers must be different" })
      } else {
        seen.add(text.toLowerCase())
      }
    })
  })

export type QuackFormValues = z.infer<typeof quackFormSchema>

export const emptyOptions = (): QuackFormValues["options"] =>
  Array.from({ length: MIN_POLL_OPTIONS }, () => ({ text: "" }))
