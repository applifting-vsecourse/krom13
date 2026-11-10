import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { threadSchema } from "@/features/quack/api/quackSchemas"
import { FEED_REFRESH_MS } from "@/features/quack/api/quacksQueryOptions"

export const threadQueryOptions = (quackId: string) =>
  queryOptions({
    queryKey: quackKeys.thread(quackId),
    queryFn: async () => threadSchema.parse(await api.get(`quacks/${quackId}`).json()),
    // New replies from other people show up while the thread is open.
    refetchInterval: FEED_REFRESH_MS,
  })
