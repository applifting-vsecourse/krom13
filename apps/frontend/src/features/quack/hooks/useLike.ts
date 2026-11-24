import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toggleLike } from "@/features/quack/api/likeApi"
import { flipLikeInList, flipLikeInThread } from "@/features/quack/api/likeMath"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack, Thread } from "@/features/quack/api/quackSchemas"

const threadsKey = () => [...quackKeys.all(), "thread"] as const

export function useLike() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: quackKeys.like(),
    mutationFn: (quackId: string) => toggleLike(quackId),
    onMutate: async (quackId) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.all() })
      const previousLists = queryClient.getQueriesData<Quack[]>({ queryKey: quackKeys.lists() })
      const previousThreads = queryClient.getQueriesData<Thread>({ queryKey: threadsKey() })
      queryClient.setQueriesData<Quack[]>(
        { queryKey: quackKeys.lists() },
        (quacks) => quacks && flipLikeInList(quacks, quackId),
      )
      queryClient.setQueriesData<Thread>(
        { queryKey: threadsKey() },
        (thread) => thread && flipLikeInThread(thread, quackId),
      )
      return { previous: [...previousLists, ...previousThreads] }
    },
    onError: (_error, _quackId, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: quackKeys.all() }),
  })
}
