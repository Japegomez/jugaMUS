import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/hooks/useAuth'
import { invalidateMyMatchesDashboard, invalidatePublicExplore } from '@/hooks/useMatches'
import { LEAGUE_QUERY_STALE_TIME } from '@/constants'
import {
  acceptLeagueChallenge,
  addLeaguePair,
  cancelLeague,
  createLeague,
  createLeagueChallenge,
  getLeague,
  grantLeaguePasswordAccess,
  joinLeaguePair,
  listLeagueChallenges,
  listLeagueMatches,
  listLeagueStandings,
  recordLeagueMatchAsReferee,
  rejectLeagueChallenge,
  removeLeaguePair,
  startLeague,
  updateLeague,
  updateLeaguePair,
  type AddLeaguePairInput,
  type LeagueInsert,
  type LeagueUpdate,
  type UpdateLeaguePairInput,
} from '@/services/leagues.service'

export function leagueQueryKey(id: string) {
  return ['league', id] as const
}

export function leagueStandingsQueryKey(id: string) {
  return ['league-standings', id] as const
}

export function leagueMatchesQueryKey(id: string) {
  return ['league-matches', id] as const
}

export function leagueChallengesQueryKey(id: string) {
  return ['league-challenges', id] as const
}

export function invalidateLeagueQueries(queryClient: QueryClient, leagueId: string) {
  queryClient.invalidateQueries({ queryKey: leagueQueryKey(leagueId) })
  queryClient.invalidateQueries({ queryKey: leagueStandingsQueryKey(leagueId) })
  queryClient.invalidateQueries({ queryKey: leagueMatchesQueryKey(leagueId) })
  queryClient.invalidateQueries({ queryKey: leagueChallengesQueryKey(leagueId) })
}

export function useLeague(id: string) {
  return useQuery({
    queryKey: leagueQueryKey(id),
    queryFn: () => getLeague(id),
    enabled: Boolean(id),
    staleTime: LEAGUE_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useLeagueStandings(id: string, enabled = true) {
  return useQuery({
    queryKey: leagueStandingsQueryKey(id),
    queryFn: () => listLeagueStandings(id),
    enabled: Boolean(id) && enabled,
    staleTime: LEAGUE_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useLeagueMatches(id: string, enabled = true) {
  return useQuery({
    queryKey: leagueMatchesQueryKey(id),
    queryFn: () => listLeagueMatches(id),
    enabled: Boolean(id) && enabled,
    staleTime: LEAGUE_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useLeagueChallenges(id: string, enabled = true) {
  return useQuery({
    queryKey: leagueChallengesQueryKey(id),
    queryFn: () => listLeagueChallenges(id),
    enabled: Boolean(id) && enabled,
    staleTime: LEAGUE_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useCreateLeague() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ data, password }: { data: LeagueInsert; password?: string }) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return createLeague(sessionUserId, data, password)
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: leagueQueryKey(row.id) })
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useUpdateLeague() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      id,
      data,
      password,
    }: {
      id: string
      data: LeagueUpdate
      password?: string
    }) => updateLeague(id, data, password),
    onSuccess: (row) => {
      invalidateLeagueQueries(queryClient, row.id)
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useCancelLeague() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (id: string) => cancelLeague(id),
    onSuccess: (row) => {
      invalidateLeagueQueries(queryClient, row.id)
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
      queryClient.invalidateQueries({ queryKey: ['match'], exact: false })
    },
  })
}

export function useGrantLeaguePasswordAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leagueId, password }: { leagueId: string; password: string }) =>
      grantLeaguePasswordAccess(leagueId, password),
    onSuccess: (_void, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      invalidatePublicExplore(queryClient)
    },
  })
}

export function useAddLeaguePair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (input: AddLeaguePairInput) => addLeaguePair(input),
    onSuccess: (_pair, input) => {
      invalidateLeagueQueries(queryClient, input.leagueId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useJoinLeaguePair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      pairId,
      slot,
      asText,
      leagueId: _leagueId,
    }: {
      pairId: string
      slot: 'a' | 'b'
      asText?: string | null
      leagueId: string
    }) => joinLeaguePair(pairId, slot, asText),
    onSuccess: (_pair, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useUpdateLeaguePair() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateLeaguePairInput & { leagueId: string }) => updateLeaguePair(input),
    onSuccess: (_pair, input) => {
      invalidateLeagueQueries(queryClient, input.leagueId)
    },
  })
}

export function useRemoveLeaguePair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ pairId, leagueId: _leagueId }: { pairId: string; leagueId: string }) =>
      removeLeaguePair(pairId),
    onSuccess: (_void, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useStartLeague() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ leagueId, format }: { leagueId: string; format: string }) =>
      startLeague(leagueId, format),
    onSuccess: (_void, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useCreateLeagueChallenge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      leagueId,
      challengedPairId,
    }: {
      leagueId: string
      challengedPairId: string
    }) => createLeagueChallenge(leagueId, challengedPairId),
    onSuccess: (_ch, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
    },
  })
}

export function useAcceptLeagueChallenge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ challengeId, leagueId: _leagueId }: { challengeId: string; leagueId: string }) =>
      acceptLeagueChallenge(challengeId),
    onSuccess: (_ch, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      queryClient.invalidateQueries({ queryKey: ['match'], exact: false })
    },
  })
}

export function useRejectLeagueChallenge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ challengeId, leagueId: _leagueId }: { challengeId: string; leagueId: string }) =>
      rejectLeagueChallenge(challengeId),
    onSuccess: (_ch, { leagueId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
    },
  })
}

export function useRecordLeagueMatchAsReferee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      matchId,
      teamAGames,
      teamBGames,
      leagueId: _leagueId,
    }: {
      matchId: string
      teamAGames: number
      teamBGames: number
      leagueId: string
    }) => recordLeagueMatchAsReferee(matchId, teamAGames, teamBGames),
    onSuccess: (_void, { leagueId, matchId }) => {
      invalidateLeagueQueries(queryClient, leagueId)
      queryClient.invalidateQueries({ queryKey: ['match', matchId] })
    },
  })
}
