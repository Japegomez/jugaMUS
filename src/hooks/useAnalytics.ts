import { useQuery } from '@tanstack/react-query'

import {
  fetchAnalyticsSummary,
  fetchMatchesByCity,
  fetchMatchesByWeek,
  fetchUserRanking,
} from '@/services/admin.service'

export const analyticsSummaryKey = ['admin', 'analytics', 'summary'] as const
export const analyticsByWeekKey = ['admin', 'analytics', 'by-week'] as const
export const analyticsByCityKey = ['admin', 'analytics', 'by-city'] as const
export const analyticsUserRankingKey = ['admin', 'analytics', 'user-ranking'] as const

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsSummaryKey,
    queryFn: fetchAnalyticsSummary,
  })
}

export function useMatchesByWeek(weeks = 12) {
  return useQuery({
    queryKey: [...analyticsByWeekKey, weeks],
    queryFn: () => fetchMatchesByWeek(weeks),
  })
}

export function useMatchesByCity(limit = 10) {
  return useQuery({
    queryKey: [...analyticsByCityKey, limit],
    queryFn: () => fetchMatchesByCity(limit),
  })
}

export function useUserRanking(limit = 20) {
  return useQuery({
    queryKey: [...analyticsUserRankingKey, limit],
    queryFn: () => fetchUserRanking(limit),
  })
}
