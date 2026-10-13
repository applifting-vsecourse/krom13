import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"

import { updateProfile } from "@/features/auth/api/updateProfile"

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    // Refetch the session so the header, the post form default and every
    // @username on the page pick up the change straight away.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.session() }),
  })
}
