import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getProfile, updateProfile, uploadAvatar } from '@/services/profiles.service'
import type { ProfileUpdate } from '@/services/profiles.service'
import { useAuthStore } from '@/hooks/useAuth'

export function profileQueryKey(userId: string) {
  return ['profile', userId] as const
}

/** Fetch the current user's profile (or any userId passed explicitly). */
export function useProfile(userId?: string) {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const resolvedId = userId ?? sessionUserId

  return useQuery({
    queryKey: profileQueryKey(resolvedId ?? ''),
    queryFn: () => getProfile(resolvedId!),
    enabled: Boolean(resolvedId),
  })
}

/** Mutation to update profile fields. Invalidates the profile query on success. */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (updates: ProfileUpdate) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return updateProfile(sessionUserId, updates)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(profileQueryKey(updated.id), updated)
    },
  })
}

/** Mutation to upload a new avatar image. Returns the updated profile. */
export function useUploadAvatar() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: async (input: { uri: string; mimeType?: string | null }) => {
      if (!sessionUserId) throw new Error('No autenticado')
      await uploadAvatar(sessionUserId, input.uri, input.mimeType)
      return getProfile(sessionUserId)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(profileQueryKey(updated.id), updated)
    },
  })
}
