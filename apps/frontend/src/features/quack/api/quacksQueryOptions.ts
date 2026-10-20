import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// The server ignores searches shorter than this, so we don't send them.
export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_LENGTH = 100

// Other people's votes show up within this long while the feed is open.
export const FEED_REFRESH_MS = 10_000

export type QuackTab = "all" | "mine"

export const quacksQueryOptions = (
  search = "",
  { isAutoRefresh = true, tab = "all" }: { isAutoRefresh?: boolean; tab?: QuackTab } = {},
) => {
  const q = search.trim().length >= MIN_SEARCH_LENGTH ? search.trim() : ""

  return queryOptions({
    queryKey: quackKeys.list(q, tab),
    queryFn: async () => {
      // The server does the filtering: "Mine" is never a hide-rows-in-the-browser trick.
      const searchParams = { ...(q && { q }), ...(tab === "mine" && { author: "me" }) }
      return quacksSchema.parse(await api.get("quacks", { searchParams }).json())
    },
    // Keep showing the previous results while the next search loads.
    placeholderData: keepPreviousData,
    // Pausing while a vote is in flight keeps a refresh from overwriting the
    // instant update. Hidden tabs don't poll; focusing one refetches.
    refetchInterval: isAutoRefresh ? FEED_REFRESH_MS : false,
  })
}
