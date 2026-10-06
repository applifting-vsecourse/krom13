import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  quacksQueryOptions,
} from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
})

function QuacksPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const quacksQuery = useQuery(quacksQueryOptions(debouncedSearch))
  const clearSearch = () => setSearch("")

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm className="mb-4" />

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
          quacks={quacksQuery.data ?? []}
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
