import type { QueryClient } from '@tanstack/react-query'

import {
  invalidateMyMatchesDashboard,
  invalidatePublicExplore,
  matchQueryKey,
  userMatchesQueryKey,
} from '@/hooks/useMatches'
import { invalidateTournamentQueries } from '@/hooks/useTournaments'

export type { RealtimeListTable } from '@/lib/realtimeRowIds'
export { idsFromRealtimeRow } from '@/lib/realtimeRowIds'

export type ExploreCacheInvalidationContext = {
  userId?: string | null
  matchId?: string | null
  tournamentId?: string | null
}

/** Invalidate list and detail caches after Realtime postgres_changes. */
export function invalidateAllExploreListQueries(
  queryClient: QueryClient,
  ctx: ExploreCacheInvalidationContext = {}
): void {
  const { userId, matchId, tournamentId } = ctx

  invalidatePublicExplore(queryClient)

  if (userId) {
    invalidateMyMatchesDashboard(queryClient, userId)
    queryClient.invalidateQueries({ queryKey: userMatchesQueryKey(userId) })
  } else {
    queryClient.invalidateQueries({ queryKey: ['my-matches-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['user-matches'] })
  }

  queryClient.invalidateQueries({
    queryKey: ['viewable-user-matches'],
    exact: false,
  })

  if (matchId) {
    queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
    queryClient.invalidateQueries({
      queryKey: [...matchQueryKey(matchId), 'match_result'],
      exact: false,
    })
    if (tournamentId) {
      invalidateTournamentQueries(queryClient, tournamentId)
    }
  }

  if (tournamentId) {
    invalidateTournamentQueries(queryClient, tournamentId)
  }
}
