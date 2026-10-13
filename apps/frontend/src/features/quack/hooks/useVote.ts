import { useMutation, useQueryClient } from "@tanstack/react-query"

import { HTTPError } from "@/lib/api-client"

import { voteOnPoll } from "@/features/quack/api/pollApi"
import { applyVote } from "@/features/quack/api/pollMath"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export function useVote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: quackKeys.vote(),
    mutationFn: voteOnPoll,
    // Show the vote at once; the server's numbers replace it afterwards.
    onMutate: async ({ quackId, optionId }) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      const previous = queryClient.getQueriesData<Quack[]>({ queryKey: quackKeys.lists() })
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.map((quack) =>
          quack.id === quackId && quack.poll
            ? { ...quack, poll: applyVote(quack.poll, optionId) }
            : quack,
        ),
      )
      return { previous }
    },
    // Back to what the server last said.
    onError: (_error, _input, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
  })
}

export function isPollClosedError(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 409
}
