import type { QueryClient } from '@tanstack/react-query'

import {
  invalidateMyMatchesDashboard,
  invalidatePublicExplore,
  matchQueryKey,
  userMatchesQueryKey,
} from '@/hooks/useMatches'
import { invalidateTournamentQueries } from '@/hooks/useTournaments'

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

export type RealtimeListTable =
  | 'matches'
  | 'match_participants'
  | 'match_results'
  | 'tournaments'
  | 'tournament_pairs'

/** Map a changed row to match/tournament detail query keys. */
export function idsFromRealtimeRow(
  table: RealtimeListTable,
  record: Record<string, unknown> | undefined
): { matchId?: string; tournamentId?: string } {
  if (!record) return {}

  switch (table) {
    case 'matches': {
      const matchId = typeof record.id === 'string' ? record.id : undefined
      const tournamentId =
        typeof record.tournament_id === 'string' ? record.tournament_id : undefined
      return { matchId, tournamentId }
    }
    case 'match_participants':
    case 'match_results':
      return {
        matchId: typeof record.match_id === 'string' ? record.match_id : undefined,
      }
    case 'tournaments':
      return {
        tournamentId: typeof record.id === 'string' ? record.id : undefined,
      }
    case 'tournament_pairs':
      return {
        tournamentId: typeof record.tournament_id === 'string' ? record.tournament_id : undefined,
      }
    default:
      return {}
  }
}
