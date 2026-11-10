import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Loader2, RefreshCw } from "lucide-react"

import { ROUTES } from "@/app/routes"
import { Seo } from "@/components/Seo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { HTTPError } from "@/lib/api-client"

import { useSession } from "@/features/auth/hooks/useSession"
import { threadQueryOptions } from "@/features/quack/api/threadQueryOptions"
import { ThreadView } from "@/features/quack/components/ThreadView"

// `quacks_` keeps this page from nesting under the feed route (the feed has no Outlet).
export const Route = createFileRoute("/_ProtectedPages/quacks_/$quackId")({
  component: ThreadPage,
})

function ThreadPage() {
  const { quackId } = Route.useParams()
  const { user } = useSession()
  const threadQuery = useQuery(threadQueryOptions(quackId))
  const isMissing =
    threadQuery.error instanceof HTTPError && threadQuery.error.response.status === 404

  return (
    <>
      <Seo title="Quack" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-2 -ml-3"
        >
          <Link to={ROUTES.quacks}>All quacks</Link>
        </Button>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quack</h1>

        {threadQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}

        {isMissing ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This quack doesn&apos;t exist.
          </p>
        ) : threadQuery.error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load this quack</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{threadQuery.error.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void threadQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {threadQuery.data ? (
          <ThreadView
            thread={threadQuery.data}
            currentUserId={user?.id}
            isModerator={user?.role === "admin"}
            defaultMood={user?.defaultMood}
          />
        ) : null}
      </section>
    </>
  )
}
