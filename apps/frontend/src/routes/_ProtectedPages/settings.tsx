import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { SettingsForm } from "@/features/auth/components/SettingsForm"
import { useSession } from "@/features/auth/hooks/useSession"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useSession()
  if (!user) return null

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
        <SettingsForm
          saved={{
            username: user.username,
            name: user.name,
            bio: user.bio,
            defaultMood: user.defaultMood,
          }}
        />
      </section>
    </>
  )
}
