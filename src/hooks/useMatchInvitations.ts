import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { QUERY_STALE_TIME } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { invalidateMyMatchesDashboard, matchQueryKey } from '@/hooks/useMatches'
import {
  cancelMatchInvitation,
  inviteFriendToMatch,
  listMatchInvitations,
  listMyMatchInvitations,
  respondMatchInvitation,
  type MatchInvitationRow,
  type MyMatchInvitationRow,
} from '@/services/matchInvitations.service'

// ─── Query keys ──────────────────────────────────────────────────────────────

export function myMatchInvitationsQueryKey(userId: string) {
  return ['my-match-invitations', userId] as const
}

export function matchInvitationsQueryKey(matchId: string) {
  return [...matchQueryKey(matchId), 'invitations'] as const
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMyMatchInvitations() {
  const userId = useAuthStore((s) => s.session?.user.id)
  return useQuery<MyMatchInvitationRow[]>({
    queryKey: myMatchInvitationsQueryKey(userId ?? ''),
    queryFn: () => listMyMatchInvitations(),
    enabled: Boolean(userId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useMatchInvitations(matchId: string) {
  return useQuery<MatchInvitationRow[]>({
    queryKey: matchInvitationsQueryKey(matchId),
    queryFn: () => listMatchInvitations(matchId),
    enabled: Boolean(matchId),
    staleTime: QUERY_STALE_TIME,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useInviteFriendToMatch() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({
      matchId,
      inviteeId,
      team,
    }: {
      matchId: string
      inviteeId: string
      team: string
    }) => inviteFriendToMatch(matchId, inviteeId, team),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: matchInvitationsQueryKey(variables.matchId) })
      queryClient.invalidateQueries({ queryKey: matchQueryKey(variables.matchId) })
      invalidateMyMatchesDashboard(queryClient, userId)
    },
  })
}

export function useRespondMatchInvitation() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      respondMatchInvitation(invitationId, accept),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: myMatchInvitationsQueryKey(userId) })
        invalidateMyMatchesDashboard(queryClient, userId)
      }
      queryClient.invalidateQueries({ queryKey: ['match'] })
    },
  })
}

export function useCancelMatchInvitation() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: (invitationId: string) => cancelMatchInvitation(invitationId),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: myMatchInvitationsQueryKey(userId) })
        invalidateMyMatchesDashboard(queryClient, userId)
      }
      queryClient.invalidateQueries({ queryKey: ['match'] })
    },
  })
}

export type { MatchInvitationRow, MyMatchInvitationRow }
