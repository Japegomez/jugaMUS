import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelMatch,
  createMatch,
  getMatch,
  getUserMatches,
  joinMatch,
  leaveMatch,
  updateMatch,
} from '@/services/matches.service'
import type { MatchInsert, MatchUpdate } from '@/services/matches.service'
import { useAuthStore } from '@/hooks/useAuth'
import { QUERY_STALE_TIME } from '@/constants'

// ─── Query keys ──────────────────────────────────────────────────────────────

export function matchQueryKey(id: string) {
  return ['match', id] as const
}

export function userMatchesQueryKey(userId: string) {
  return ['user-matches', userId] as const
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useMatch(id: string) {
  return useQuery({
    queryKey: matchQueryKey(id),
    queryFn: () => getMatch(id),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useUserMatches(userId?: string) {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const resolvedId = userId ?? sessionUserId

  return useQuery({
    queryKey: userMatchesQueryKey(resolvedId ?? ''),
    queryFn: () => getUserMatches(resolvedId!),
    enabled: Boolean(resolvedId),
    staleTime: QUERY_STALE_TIME,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateMatch() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (data: MatchInsert) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return createMatch(sessionUserId, data)
    },
    onSuccess: () => {
      if (sessionUserId) {
        queryClient.invalidateQueries({
          queryKey: userMatchesQueryKey(sessionUserId),
        })
      }
    },
  })
}

export function useUpdateMatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MatchUpdate }) => updateMatch(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(matchQueryKey(updated.id), (prev: unknown) => {
        if (!prev) return prev
        return { ...(prev as object), ...updated }
      })
    },
  })
}

export function useCancelMatch() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (id: string) => cancelMatch(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(matchQueryKey(updated.id), (prev: unknown) => {
        if (!prev) return prev
        return { ...(prev as object), status: updated.status }
      })
      if (sessionUserId) {
        queryClient.invalidateQueries({
          queryKey: userMatchesQueryKey(sessionUserId),
        })
      }
    },
  })
}

export function useJoinMatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId, userId, team }: { matchId: string; userId: string; team: string }) =>
      joinMatch(matchId, userId, team),
    onSuccess: (_participant, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
    },
  })
}

export function useLeaveMatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId, userId }: { matchId: string; userId: string }) =>
      leaveMatch(matchId, userId),
    onSuccess: (_participant, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
    },
  })
}
