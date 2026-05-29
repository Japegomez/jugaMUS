import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/hooks/useAuth'
import { invalidateMyMatchesDashboard, invalidatePublicExplore } from '@/hooks/useMatches'
import { TOURNAMENT_QUERY_STALE_TIME, TOURNAMENT_REFETCH_INTERVAL } from '@/constants'
import {
  addTournamentPair,
  createTournament,
  generateTournamentBracket,
  getTournament,
  getTournamentBracket,
  joinTournamentPair,
  recordTournamentMatchAsReferee,
  removeTournamentPair,
  updateTournament,
  updateTournamentPair,
  type AddPairInput,
  type UpdatePairInput,
  type TournamentInsert,
  type TournamentUpdate,
} from '@/services/tournaments.service'

export function tournamentQueryKey(id: string) {
  return ['tournament', id] as const
}

export function tournamentBracketQueryKey(id: string) {
  return ['tournament-bracket', id] as const
}

export function invalidateTournamentQueries(queryClient: QueryClient, tournamentId: string) {
  queryClient.invalidateQueries({ queryKey: tournamentQueryKey(tournamentId) })
  queryClient.invalidateQueries({ queryKey: tournamentBracketQueryKey(tournamentId) })
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: tournamentQueryKey(id),
    queryFn: () => getTournament(id),
    enabled: Boolean(id),
    staleTime: TOURNAMENT_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
    refetchInterval: TOURNAMENT_REFETCH_INTERVAL,
  })
}

export function useTournamentBracket(id: string) {
  return useQuery({
    queryKey: tournamentBracketQueryKey(id),
    queryFn: () => getTournamentBracket(id),
    enabled: Boolean(id),
    staleTime: TOURNAMENT_QUERY_STALE_TIME,
    refetchOnWindowFocus: true,
    refetchInterval: TOURNAMENT_REFETCH_INTERVAL,
  })
}

export function useCreateTournament() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (data: TournamentInsert) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return createTournament(sessionUserId, data)
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: tournamentQueryKey(row.id) })
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useUpdateTournament() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TournamentUpdate }) =>
      updateTournament(id, data),
    onSuccess: (row) => {
      invalidateTournamentQueries(queryClient, row.id)
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useAddTournamentPair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (input: AddPairInput) => addTournamentPair(input),
    onSuccess: (_pair, input) => {
      invalidateTournamentQueries(queryClient, input.tournamentId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useJoinTournamentPair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      pairId,
      slot,
      asText,
      tournamentId: _tournamentId,
    }: {
      pairId: string
      slot: 'a' | 'b'
      asText?: string | null
      tournamentId: string
    }) => joinTournamentPair(pairId, slot, asText),
    onSuccess: (_pair, vars) => {
      invalidateTournamentQueries(queryClient, vars.tournamentId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useUpdateTournamentPair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (input: UpdatePairInput & { tournamentId: string }) =>
      updateTournamentPair({
        pairId: input.pairId,
        name: input.name,
        playerAText: input.playerAText,
        playerBText: input.playerBText,
      }),
    onSuccess: (_pair, input) => {
      invalidateTournamentQueries(queryClient, input.tournamentId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useRemoveTournamentPair() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      pairId,
      tournamentId: _tournamentId,
    }: {
      pairId: string
      tournamentId: string
    }) => removeTournamentPair(pairId),
    onSuccess: (_void, vars) => {
      invalidateTournamentQueries(queryClient, vars.tournamentId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useGenerateTournamentBracket() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (tournamentId: string) => generateTournamentBracket(tournamentId),
    onSuccess: (_void, tournamentId) => {
      invalidateTournamentQueries(queryClient, tournamentId)
      invalidatePublicExplore(queryClient)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
    },
  })
}

export function useRecordTournamentMatchAsReferee() {
  const queryClient = useQueryClient()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({
      matchId,
      tournamentId: _tournamentId,
      teamAGames,
      teamBGames,
    }: {
      matchId: string
      tournamentId: string
      teamAGames: number
      teamBGames: number
    }) => recordTournamentMatchAsReferee(matchId, teamAGames, teamBGames),
    onSuccess: (_void, { matchId, tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] })
      queryClient.invalidateQueries({
        queryKey: ['match', matchId, 'match_result'],
        exact: false,
      })
      invalidateTournamentQueries(queryClient, tournamentId)
      invalidateMyMatchesDashboard(queryClient, sessionUserId)
      invalidatePublicExplore(queryClient)
    },
  })
}
