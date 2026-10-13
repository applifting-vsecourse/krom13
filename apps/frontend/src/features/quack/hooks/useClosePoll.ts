import { useMutation, useQueryClient } from "@tanstack/react-query"

import { closePoll } from "@/features/quack/api/pollApi"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useClosePoll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: closePoll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
  })
}
