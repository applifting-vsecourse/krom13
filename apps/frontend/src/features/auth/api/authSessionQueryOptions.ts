import { queryOptions } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"
import { moodSchema, type Mood } from "@/lib/moods"

import { authClient } from "@/features/auth/lib/auth-client"

export type SessionUser = {
  id: string
  email: string
  name: string
  username: string
  bio: string
  defaultMood?: Mood
  role?: string
}

export type Session = {
  user: SessionUser
} | null

export const authSessionQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: async (): Promise<Session> => {
      const { data, error } = await authClient.getSession()
      if (error) throw new Error(error.message ?? "Failed to load session")
      if (!data?.user) return null

      const user = data.user as typeof data.user & {
        username?: string | null
        bio?: string | null
        defaultMood?: string | null
        role?: string | null
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username ?? "",
          bio: user.bio ?? "",
          defaultMood: moodSchema.safeParse(user.defaultMood).data,
          role: user.role ?? undefined,
        },
      }
    },
    staleTime: 30_000,
  })
