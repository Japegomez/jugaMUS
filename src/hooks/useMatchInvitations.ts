import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { QUERY_STALE_TIME } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { invalidateMyMatchesDashboard } from '@/hooks/useMatches'
import {
  invalidateMatchInvitationQueries,
  matchInvitationsQueryKey,
  myMatchInvitationsQueryKey,
} from '@/lib/matchQueryKeys'
import {
  cancelMatchInvitation,
  inviteFriendToMatch,
  listMatchInvitations,
  listMyMatchInvitations,
  respondMatchInvitation,
  type MatchInvitationRow,
  type MyMatchInvitationRow,
} from '@/services/matchInvitations.service'

export {
  invalidateMatchInvitationQueries,
  matchInvitationsQueryKey,
  myMatchInvitationsQueryKey,
} from '@/lib/matchQueryKeys'

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
      invalidateMatchInvitationQueries(queryClient, {
        userId,
        matchId: variables.matchId,
      })
      invalidateMyMatchesDashboard(queryClient, userId)
    },
  })
}

export function useRespondMatchInvitation() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({
      invitationId,
      accept,
      matchId,
      team,
    }: {
      invitationId: string
      accept: boolean
      matchId?: string
      team?: string
    }) =>
      respondMatchInvitation(invitationId, accept, matchId && team ? { matchId, team } : undefined),
    onSuccess: (_data, variables) => {
      invalidateMatchInvitationQueries(queryClient, {
        userId,
        matchId: variables.matchId,
      })
      if (userId) {
        invalidateMyMatchesDashboard(queryClient, userId)
      }
    },
  })
}

export function useCancelMatchInvitation() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({ invitationId }: { invitationId: string; matchId?: string }) =>
      cancelMatchInvitation(invitationId),
    onSuccess: (_data, variables) => {
      invalidateMatchInvitationQueries(queryClient, {
        userId,
        matchId: variables.matchId,
      })
      if (userId) {
        invalidateMyMatchesDashboard(queryClient, userId)
      }
    },
  })
}

export type { MatchInvitationRow, MyMatchInvitationRow }
