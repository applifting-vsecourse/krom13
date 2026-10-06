import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// The server ignores searches shorter than this, so we don't send them.
export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_LENGTH = 100

export const quacksQueryOptions = (search = "") => {
  const q = search.trim().length >= MIN_SEARCH_LENGTH ? search.trim() : ""

  return queryOptions({
    queryKey: quackKeys.list(q),
    queryFn: async () =>
      quacksSchema.parse(await api.get("quacks", { searchParams: q ? { q } : undefined }).json()),
    // Keep showing the previous results while the next search loads.
    placeholderData: keepPreviousData,
  })
}
