import type { QueryClient } from '@tanstack/react-query'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelMatch,
  createMatch,
  getMatch,
  getMyMatchesDashboard,
  getUserMatches,
  getViewableUserMatches,
  joinMatch,
  leaveMatch,
  listPublicMatchesPage,
  recordMatchResultDirect,
  updateMatch,
} from '@/services/matches.service'
import type { MatchInsert, MatchUpdate, PublicMatchesListFilters } from '@/services/matches.service'
import {
  listPublicTournamentsFiltered,
  type PublicTournamentsListFilters,
} from '@/services/tournaments.service'
import { useAuthStore } from '@/hooks/useAuth'
import { invalidateTournamentQueries } from '@/hooks/useTournaments'
import {
  MATCH_PAGE_SIZE,
  QUERY_STALE_TIME,
  TAB_SCREEN_QUERY_OPTIONS,
  TOURNAMENT_QUERY_STALE_TIME,
} from '@/constants'

// ─── Query keys ──────────────────────────────────────────────────────────────

export function matchQueryKey(id: string) {
  return ['match', id] as const
}

/** Latest `match_results` (+ viewer confirmation) for a match detail screen. */
export function matchResultQueryKey(matchId: string, viewerUserId?: string | null) {
  return [...matchQueryKey(matchId), 'match_result', viewerUserId ?? 'anon'] as const
}

export function userMatchesQueryKey(userId: string) {
  return ['user-matches', userId] as const
}

export function viewableUserMatchesQueryKey(userId: string) {
  return ['viewable-user-matches', userId] as const
}

export function myMatchesDashboardQueryKey(userId: string) {
  return ['my-matches-dashboard', userId] as const
}

export function invalidateMyMatchesDashboard(queryClient: QueryClient, userId?: string | null) {
  if (!userId) return
  queryClient.invalidateQueries({ queryKey: myMatchesDashboardQueryKey(userId) })
}

export const PUBLIC_MATCHES_EXPLORE_ROOT = 'public-matches-explore' as const
export const PUBLIC_TOURNAMENTS_EXPLORE_ROOT = 'public-tournaments-explore' as const

export function publicTournamentsExploreQueryKey(filters: PublicTournamentsListFilters) {
  return [
    PUBLIC_TOURNAMENTS_EXPLORE_ROOT,
    filters.contentType,
    filters.search.trim(),
    filters.city.trim(),
    filters.status ?? '',
    filters.hideCelebrated,
    filters.startAfter ?? '',
    filters.startBefore ?? '',
    filters.minFreeSlots,
  ] as const
}

function invalidatePublicMatchesExplore(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: [PUBLIC_MATCHES_EXPLORE_ROOT],
    exact: false,
  })
}

function invalidatePublicTournamentsExplore(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: [PUBLIC_TOURNAMENTS_EXPLORE_ROOT],
    exact: false,
  })
}

export function invalidatePublicExplore(queryClient: QueryClient) {
  invalidatePublicMatchesExplore(queryClient)
  invalidatePublicTournamentsExplore(queryClient)
}

export function publicMatchesExploreQueryKey(filters: PublicMatchesListFilters) {
  return [
    PUBLIC_MATCHES_EXPLORE_ROOT,
    filters.contentType,
    filters.search.trim(),
    filters.city.trim(),
    filters.status ?? '',
    filters.hideCelebrated,
    filters.startAfter ?? '',
    filters.startBefore ?? '',
    filters.minFreeSlots,
  ] as const
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useMatch(id: string) {
  return useQuery({
    queryKey: matchQueryKey(id),
    queryFn: () => getMatch(id),
    enabled: Boolean(id),
    staleTime: TOURNAMENT_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useUserMatches(userId?: string) {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const resolvedId = userId ?? sessionUserId

  return useQuery({
    queryKey: userMatchesQueryKey(resolvedId ?? ''),
    queryFn: () => getUserMatches(resolvedId!),
    enabled: Boolean(resolvedId),
    ...TAB_SCREEN_QUERY_OPTIONS,
    refetchOnReconnect: true,
  })
}

export function useViewableUserMatches(userId?: string) {
  return useQuery({
    queryKey: viewableUserMatchesQueryKey(userId ?? ''),
    queryFn: () => getViewableUserMatches(userId!),
    enabled: Boolean(userId),
    ...TAB_SCREEN_QUERY_OPTIONS,
  })
}

export function useMyMatchesDashboard() {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useQuery({
    queryKey: myMatchesDashboardQueryKey(sessionUserId ?? ''),
    queryFn: () => getMyMatchesDashboard(sessionUserId!),
    enabled: Boolean(sessionUserId),
    ...TAB_SCREEN_QUERY_OPTIONS,
  })
}

/** F5 — partidas públicas con paginación (20) y cache 5 min. */
export function useInfinitePublicMatches(filters: PublicMatchesListFilters) {
  return useInfiniteQuery({
    queryKey: publicMatchesExploreQueryKey(filters),
    queryFn: ({ pageParam }) =>
      listPublicMatchesPage({
        ...filters,
        limit: MATCH_PAGE_SIZE,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.rows.length, 0)
      if (lastPage.total <= 0 || loaded >= lastPage.total) return undefined
      return loaded
    },
    enabled: filters.contentType !== 'tournaments',
    staleTime: QUERY_STALE_TIME,
  })
}

export function usePublicTournamentsExplore(filters: PublicTournamentsListFilters) {
  return useQuery({
    queryKey: publicTournamentsExploreQueryKey(filters),
    queryFn: () => listPublicTournamentsFiltered(filters),
    enabled: filters.contentType !== 'matches',
    ...TAB_SCREEN_QUERY_OPTIONS,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateMatch() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: async (data: MatchInsert) => {
      if (!sessionUserId) throw new Error('No autenticado')
      const match = await createMatch(sessionUserId, data)
      await queryClient.prefetchQuery({
        queryKey: matchQueryKey(match.id),
        queryFn: () => getMatch(match.id),
      })
      return match
    },
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(match.id) })
      if (sessionUserId) {
        queryClient.invalidateQueries({
          queryKey: userMatchesQueryKey(sessionUserId),
        })
        invalidateMyMatchesDashboard(queryClient, sessionUserId)
      }
      invalidatePublicMatchesExplore(queryClient)
    },
  })
}

export function useUpdateMatch() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MatchUpdate }) => updateMatch(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(matchQueryKey(updated.id), (prev: unknown) => {
        if (!prev) return prev
        return { ...(prev as object), ...updated }
      })
      invalidatePublicMatchesExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
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
      queryClient.invalidateQueries({
        queryKey: [...matchQueryKey(updated.id), 'match_result'],
        exact: false,
      })
      if (sessionUserId) {
        queryClient.invalidateQueries({
          queryKey: userMatchesQueryKey(sessionUserId),
        })
        invalidateMyMatchesDashboard(queryClient, sessionUserId)
      }
      if (updated.tournament_id) {
        invalidateTournamentQueries(queryClient, updated.tournament_id)
      }
      invalidatePublicExplore(queryClient)
    },
  })
}

export function useJoinMatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId, userId, team }: { matchId: string; userId: string; team: string }) =>
      joinMatch(matchId, userId, team),
    onSuccess: (_participant, { matchId, userId }) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
      invalidatePublicMatchesExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, userId)
    },
  })
}

export function useLeaveMatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId, userId }: { matchId: string; userId: string }) =>
      leaveMatch(matchId, userId),
    onSuccess: (_participant, { matchId, userId }) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
      invalidatePublicMatchesExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, userId)
    },
  })
}

export function useRecordMatchResultDirect() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      matchId,
      teamAGames,
      teamBGames,
    }: {
      matchId: string
      teamAGames: number
      teamBGames: number
    }) => recordMatchResultDirect(matchId, teamAGames, teamBGames),
    onSuccess: (_void, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey(matchId) })
      queryClient.invalidateQueries({
        queryKey: [...matchQueryKey(matchId), 'match_result'],
        exact: false,
      })
      if (sessionUserId) {
        queryClient.invalidateQueries({
          queryKey: userMatchesQueryKey(sessionUserId),
        })
        invalidateMyMatchesDashboard(queryClient, sessionUserId)
      }
      invalidatePublicMatchesExplore(queryClient)
    },
  })
}
