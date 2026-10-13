import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { env } from "@/config/env"

export const authClient = createAuthClient({
  baseURL: env.VITE_BETTER_AUTH_URL,
  plugins: [
    usernameClient(),
    // Mirrors the additional user fields in the backend's BetterAuth config.
    inferAdditionalFields({
      user: {
        bio: { type: "string", required: false },
        defaultMood: { type: "string", required: false },
      },
    }),
  ],
})
