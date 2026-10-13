import type { ProfileValues } from "@/features/auth/api/profileSchema"
import { authClient } from "@/features/auth/lib/auth-client"

export class ProfileUpdateError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

export async function updateProfile(values: ProfileValues) {
  const { error } = await authClient.updateUser({
    username: values.username,
    name: values.name,
    bio: values.bio.trim() === "" ? null : values.bio.trim(),
    defaultMood: values.defaultMood,
  })
  if (error) throw new ProfileUpdateError(error.message ?? "Could not save settings", error.code)
}
