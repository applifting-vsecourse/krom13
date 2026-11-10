import { useMutation, useQueryClient } from "@tanstack/react-query"

import { addReply } from "@/features/quack/api/addReply"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useAddReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addReply,
    // The thread shows the new reply and the feed's reply count goes up.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quackKeys.all() }),
  })
}
