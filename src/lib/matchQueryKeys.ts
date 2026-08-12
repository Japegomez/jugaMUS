import type { QueryClient } from '@tanstack/react-query'

/** Shared match / invitation query keys (no hooks — avoids circular imports). */

export function matchQueryKey(id: string) {
  return ['match', id] as const
}

export function myMatchInvitationsQueryKey(userId: string) {
  return ['my-match-invitations', userId] as const
}

export function matchInvitationsQueryKey(matchId: string) {
  return [...matchQueryKey(matchId), 'invitations'] as const
}

export function invalidateMatchInvitationQueries(
  queryClient: QueryClient,
  opts: { userId?: string; matchId?: string; matchIds?: string[] } = {}
) {
  const { userId, matchId, matchIds } = opts
  if (userId) {
    queryClient.invalidateQueries({ queryKey: myMatchInvitationsQueryKey(userId) })
  }
  const ids = [...(matchIds ?? []), ...(matchId ? [matchId] : [])]
  for (const id of ids) {
    queryClient.invalidateQueries({ queryKey: matchInvitationsQueryKey(id) })
    queryClient.invalidateQueries({ queryKey: matchQueryKey(id) })
  }
}
