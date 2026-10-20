import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    // Not optimistic: a failed delete would have to put a post back.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
  })
}
