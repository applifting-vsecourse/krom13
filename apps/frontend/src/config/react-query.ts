import { QueryClient, type DefaultOptions } from "@tanstack/react-query"

const defaultQueryConfig = {
  queries: {
    // Refetching when the tab regains focus is how a feed stays fresh without
    // websockets. It is TanStack's default; don't turn it off. The only
    // polling is the 10 s feed refresh in quacksQueryOptions (see ADR 0002).
    refetchOnWindowFocus: true,
    // Fail fast and visibly in development rather than hiding errors behind retries.
    retry: 0,
  },
} satisfies DefaultOptions

export const queryClient = new QueryClient({
  defaultOptions: defaultQueryConfig,
})
