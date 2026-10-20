import { useRef, useState } from "react"
import { useIsMutating, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

import { useSession } from "@/features/auth/hooks/useSession"
import { quackKeys } from "@/features/quack/api/quackKeys"
import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  quacksQueryOptions,
  type QuackTab,
} from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"

const quacksSearchParamsSchema = z.object({
  // Anything else (a typo in a shared link) falls back to All.
  tab: z.enum(["all", "mine"]).default("all").catch("all"),
})

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  validateSearch: quacksSearchParamsSchema,
  component: QuacksPage,
})

function QuacksPage() {
  const { user } = useSession()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const formRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  // Don't refresh the feed while a vote is in flight, or it could briefly
  // undo the instant update.
  const isVoting = useIsMutating({ mutationKey: quackKeys.vote() }) > 0
  const quacksQuery = useQuery(
    quacksQueryOptions(debouncedSearch, { isAutoRefresh: !isVoting, tab }),
  )
  const clearSearch = () => setSearch("")
  const writeQuack = () => formRef.current?.querySelector("textarea")?.focus()

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <div ref={formRef}>
          <QuackForm
            className="mb-4"
            defaultMood={user?.defaultMood}
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) =>
            void navigate({ search: { tab: value as QuackTab }, replace: true })
          }
          className="mb-4"
        >
          <TabsList variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-4 flex flex-col gap-2">
          <Label htmlFor="quack-search">Search quacks</Label>
          <Input
            id="quack-search"
            type="search"
            value={search}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="A word or an author"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <QuackList
          searchQuery={
            debouncedSearch.trim().length >= MIN_SEARCH_LENGTH ? debouncedSearch.trim() : undefined
          }
          onClearSearch={clearSearch}
          isMineTab={tab === "mine"}
          onWriteQuack={writeQuack}
          quacks={quacksQuery.data ?? []}
          currentUserId={user?.id}
          isLoading={quacksQuery.isLoading}
          error={quacksQuery.error ?? undefined}
          // Only the error state offers a retry — posting invalidates the list,
          // and refocusing the tab refetches it.
          onReload={() => void quacksQuery.refetch()}
        />
      </section>
    </>
  )
}
