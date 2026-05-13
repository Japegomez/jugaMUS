import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { QUERY_STALE_TIME } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { matchQueryKey, matchResultQueryKey, userMatchesQueryKey } from '@/hooks/useMatches'
import {
  fetchMatchResultBundle,
  submitConfirmation,
  submitResult,
  type SubmitConfirmationInput,
  type SubmitResultInput,
} from '@/services/results.service'

export function useMatchResult(matchId: string) {
  const userId = useAuthStore((s) => s.session?.user.id)

  return useQuery({
    queryKey: matchResultQueryKey(matchId, userId),
    queryFn: () => fetchMatchResultBundle(matchId, userId),
    enabled: Boolean(matchId && userId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useSubmitResult() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (input: SubmitResultInput) => submitResult(input),
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(variables.matchId) })
      queryClient.invalidateQueries({
        queryKey: matchResultQueryKey(variables.matchId, sessionUserId),
      })
      if (sessionUserId) {
        queryClient.invalidateQueries({ queryKey: userMatchesQueryKey(sessionUserId) })
      }
    },
  })
}

export function useSubmitConfirmation() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (input: SubmitConfirmationInput) => submitConfirmation(input),
    onSuccess: (_void, variables) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(variables.matchId) })
      queryClient.invalidateQueries({
        queryKey: matchResultQueryKey(variables.matchId, sessionUserId),
      })
      if (sessionUserId) {
        queryClient.invalidateQueries({ queryKey: userMatchesQueryKey(sessionUserId) })
      }
    },
  })
}
