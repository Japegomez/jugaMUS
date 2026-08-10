import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

import { QUERY_STALE_TIME } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import {
  getLeaderboard,
  getMatchInsights,
  getPlayerRanking,
  getPlayerStats,
} from '@/services/stats.service'

export function playerStatsQueryKey(userId: string) {
  return ['player-stats', userId] as const
}

export function matchInsightsQueryKey(matchId: string) {
  return ['match-insights', matchId] as const
}

export function leaderboardQueryKey(city?: string | null) {
  return ['leaderboard', city?.trim() || 'all'] as const
}

export function playerRankingQueryKey(userId: string) {
  return ['player-ranking', userId] as const
}

export function invalidatePlayerStatsCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['player-stats'], exact: false })
  queryClient.invalidateQueries({ queryKey: ['match-insights'], exact: false })
  queryClient.invalidateQueries({ queryKey: ['leaderboard'], exact: false })
  queryClient.invalidateQueries({ queryKey: ['player-ranking'], exact: false })
}

export function usePlayerStats(userId?: string | null) {
  return useQuery({
    queryKey: playerStatsQueryKey(userId ?? ''),
    queryFn: () => getPlayerStats(userId!),
    enabled: Boolean(userId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useMatchInsights(matchId?: string | null) {
  const viewerId = useAuthStore((s) => s.session?.user.id)
  return useQuery({
    queryKey: matchInsightsQueryKey(matchId ?? ''),
    queryFn: () => getMatchInsights(matchId!, viewerId),
    enabled: Boolean(matchId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useLeaderboard(city?: string | null) {
  return useQuery({
    queryKey: leaderboardQueryKey(city),
    queryFn: () => getLeaderboard(city),
    staleTime: QUERY_STALE_TIME,
  })
}

export function usePlayerRanking(userId?: string | null) {
  return useQuery({
    queryKey: playerRankingQueryKey(userId ?? ''),
    queryFn: () => getPlayerRanking(userId!),
    enabled: Boolean(userId),
    staleTime: QUERY_STALE_TIME,
  })
}
