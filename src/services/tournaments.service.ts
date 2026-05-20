import { supabase } from '@/lib/supabase'
import { mapResultRpcError } from '@/services/results.service'
import { MATCH_STATUS, TOURNAMENT_STATUS, type ExploreContentType } from '@/constants'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

function startAtToTimestamptzIso(startAt: string): string {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Fecha de inicio no válida')
  }
  return d.toISOString()
}

export type TournamentRow = Tables<'tournaments'>
export type TournamentPairRow = Tables<'tournament_pairs'> & {
  player_a_display_name?: string | null
  player_b_display_name?: string | null
}

export type TournamentInsert = Pick<
  TablesInsert<'tournaments'>,
  | 'title'
  | 'description'
  | 'notes'
  | 'start_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
  | 'location_privacy'
  | 'creator_joins_as_player'
>

export type TournamentUpdate = Pick<
  TablesUpdate<'tournaments'>,
  | 'title'
  | 'description'
  | 'notes'
  | 'start_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
>

export type BracketNodeRow = {
  match_id: string
  round_size: number
  bracket_position: number
  pair_a_id: string | null
  pair_a_name: string | null
  pair_b_id: string | null
  pair_b_name: string | null
  winner_pair_id: string | null
  match_status: string
  is_bye: boolean
  is_placeholder?: boolean
  team_a_games: number | null
  team_b_games: number | null
  start_at: string
}

export type TournamentWithPairs = TournamentRow & {
  pairs: TournamentPairRow[]
  organizer_display_name?: string | null
}

export type TournamentBracket = {
  tournament: TournamentRow
  pairs: TournamentPairRow[]
  nodes: BracketNodeRow[]
}

export type AddPairInput = {
  tournamentId: string
  name: string
  playerAUserId?: string | null
  playerAText?: string | null
  playerBUserId?: string | null
  playerBText?: string | null
}

export async function createTournament(
  _userId: string,
  data: TournamentInsert
): Promise<TournamentRow> {
  const { data: row, error } = await supabase.rpc('create_tournament', {
    p_title: data.title,
    p_start_at: startAtToTimestamptzIso(data.start_at),
    p_city: data.city,
    p_duration_target_games: data.duration_target_games,
    p_description: data.description ?? null,
    p_notes: data.notes ?? null,
    p_place_defined: data.place_defined,
    p_place_text: data.place_text ?? null,
    p_visibility: data.visibility,
    p_location_privacy: data.location_privacy,
    p_creator_joins_as_player: data.creator_joins_as_player ?? false,
  })

  if (error) throw new Error(error.message)
  if (!row) throw new Error('No se pudo crear el torneo')
  return row as TournamentRow
}

export async function getTournament(id: string): Promise<TournamentWithPairs> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(
      `*,
      creator_profile:profiles!tournaments_creator_id_fkey(display_name)`
    )
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)

  const tournamentRow = tournament as TournamentRow & {
    creator_profile?: { display_name: string } | null
  }

  const { data: pairs, error: pairsError } = await supabase
    .from('tournament_pairs')
    .select(
      `*,
      player_a_profile:profiles!tournament_pairs_player_a_user_id_fkey(display_name),
      player_b_profile:profiles!tournament_pairs_player_b_user_id_fkey(display_name)`
    )
    .eq('tournament_id', id)
    .order('created_at', { ascending: true })

  if (pairsError) throw new Error(pairsError.message)

  const mappedPairs = (pairs ?? []).map((row) => {
    const r = row as TournamentPairRow & {
      player_a_profile?: { display_name: string } | null
      player_b_profile?: { display_name: string } | null
    }
    return {
      ...r,
      player_a_display_name: r.player_a_profile?.display_name ?? null,
      player_b_display_name: r.player_b_profile?.display_name ?? null,
    }
  })

  return {
    ...(tournamentRow as TournamentRow),
    organizer_display_name: tournamentRow.creator_profile?.display_name ?? null,
    pairs: mappedPairs,
  }
}

export async function updateTournament(id: string, data: TournamentUpdate): Promise<TournamentRow> {
  const payload: TournamentUpdate =
    data.start_at !== undefined
      ? { ...data, start_at: startAtToTimestamptzIso(data.start_at) }
      : data

  const { data: row, error } = await supabase
    .from('tournaments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row as TournamentRow
}

export async function addTournamentPair(input: AddPairInput): Promise<TournamentPairRow> {
  const { data, error } = await supabase.rpc('add_tournament_pair', {
    p_tournament_id: input.tournamentId,
    p_name: input.name,
    p_player_a_user_id: input.playerAUserId ?? undefined,
    p_player_a_text: input.playerAText ?? undefined,
    p_player_b_user_id: input.playerBUserId ?? undefined,
    p_player_b_text: input.playerBText ?? undefined,
  })

  if (error) throw new Error(mapTournamentPairRpcError(error.message))
  return data as TournamentPairRow
}

export async function joinTournamentPair(
  pairId: string,
  slot: 'a' | 'b',
  asText?: string | null
): Promise<TournamentPairRow> {
  const { data, error } = await supabase.rpc('join_tournament_pair', {
    p_pair_id: pairId,
    p_slot: slot,
    p_as_text: asText ?? undefined,
  })

  if (error) throw new Error(mapTournamentPairRpcError(error.message))
  return data as TournamentPairRow
}

export async function removeTournamentPair(pairId: string): Promise<void> {
  const { error } = await supabase.from('tournament_pairs').delete().eq('id', pairId)
  if (error) throw new Error(error.message)
}

export async function generateTournamentBracket(tournamentId: string): Promise<void> {
  const { error } = await supabase.rpc('generate_tournament_bracket', {
    p_tournament_id: tournamentId,
  })
  if (error) throw new Error(error.message)
}

export async function getTournamentBracket(tournamentId: string): Promise<TournamentBracket> {
  const tournament = await getTournament(tournamentId)

  const { data: nodes, error } = await supabase.rpc('list_tournament_bracket', {
    p_tournament_id: tournamentId,
  })

  if (error) throw new Error(error.message)

  return {
    tournament,
    pairs: tournament.pairs,
    nodes: (nodes ?? []) as BracketNodeRow[],
  }
}

export type PublicTournamentsListFilters = {
  search: string
  city: string
  status: string | null
  startAfter: string | null
  startBefore: string | null
  minFreeSlots: number
  contentType: ExploreContentType
}

export type UserTournamentSummary = {
  id: string
  title: string
  start_at: string
  city: string
  place_defined: boolean
  place_text: string | null
  status: string
  creator_id: string
  bracket_generated_at: string | null
  isOrganizer: boolean
}

function tournamentStatusesFromExploreFilter(matchStatus: string | null): string[] | null {
  if (!matchStatus) return null
  switch (matchStatus) {
    case MATCH_STATUS.PLANNED:
      return [TOURNAMENT_STATUS.REGISTRATION]
    case MATCH_STATUS.IN_PROGRESS:
      return [TOURNAMENT_STATUS.IN_PROGRESS]
    case MATCH_STATUS.FINISHED:
    case MATCH_STATUS.FINISHED_NO_RESULT:
      return [TOURNAMENT_STATUS.FINISHED]
    default:
      return []
  }
}

export async function listPublicTournamentsFiltered(
  filters: PublicTournamentsListFilters,
  limit = 50
): Promise<TournamentRow[]> {
  if (filters.minFreeSlots > 0) return []

  const statuses = tournamentStatusesFromExploreFilter(filters.status)
  if (statuses !== null && statuses.length === 0) return []

  let query = supabase
    .from('tournaments')
    .select('*')
    .eq('visibility', 'public')
    .neq('status', TOURNAMENT_STATUS.CANCELLED)

  const city = filters.city.trim()
  if (city) query = query.ilike('city', `%${city}%`)

  const search = filters.search.trim()
  if (search) query = query.ilike('title', `%${search}%`)

  if (filters.startAfter) query = query.gte('start_at', filters.startAfter)
  if (filters.startBefore) query = query.lte('start_at', filters.startBefore)
  if (statuses) query = query.in('status', statuses)

  const { data, error } = await query.order('start_at', { ascending: true }).limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as TournamentRow[]
}

export async function getUserTournamentsDashboard(userId: string): Promise<{
  upcoming: UserTournamentSummary[]
  inProgress: UserTournamentSummary[]
}> {
  const [createdRes, pairsRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select(
        'id, title, start_at, city, place_defined, place_text, status, creator_id, bracket_generated_at'
      )
      .eq('creator_id', userId)
      .neq('status', TOURNAMENT_STATUS.CANCELLED),
    supabase
      .from('tournament_pairs')
      .select(
        `tournament:tournaments(id, title, start_at, city, place_defined, place_text, status, creator_id, bracket_generated_at)`
      )
      .or(`player_a_user_id.eq.${userId},player_b_user_id.eq.${userId}`),
  ])

  if (createdRes.error) throw new Error(createdRes.error.message)
  if (pairsRes.error) throw new Error(pairsRes.error.message)

  type TournamentBrief = Omit<UserTournamentSummary, 'isOrganizer'>

  const byId = new Map<string, UserTournamentSummary>()

  for (const row of (createdRes.data ?? []) as TournamentBrief[]) {
    byId.set(row.id, { ...row, isOrganizer: true })
  }

  for (const row of pairsRes.data ?? []) {
    const t = row.tournament as TournamentBrief | null
    if (!t || t.status === TOURNAMENT_STATUS.CANCELLED) continue
    if (!byId.has(t.id)) {
      byId.set(t.id, { ...t, isOrganizer: t.creator_id === userId })
    }
  }

  const all = Array.from(byId.values())
  const upcoming = all
    .filter((t) => t.status === TOURNAMENT_STATUS.REGISTRATION)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  const inProgress = all
    .filter((t) => t.status === TOURNAMENT_STATUS.IN_PROGRESS)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  return { upcoming, inProgress }
}

export async function listPublicTournaments(limit = 20): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('visibility', 'public')
    .neq('status', 'cancelled')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as TournamentRow[]
}

export async function recordTournamentMatchAsReferee(
  matchId: string,
  teamAGames: number,
  teamBGames: number
): Promise<void> {
  const { error } = await supabase.rpc('record_tournament_match_result_as_referee', {
    p_match_id: matchId,
    p_team_a_games: teamAGames,
    p_team_b_games: teamBGames,
  })
  if (error) throw new Error(mapResultRpcError(error.message))
}

export function pairMemberLabels(pair: TournamentPairRow): string[] {
  const members: string[] = []
  if (pair.player_a_user_id) {
    members.push(pair.player_a_display_name ?? 'Jugador registrado')
  } else if (pair.player_a_text) {
    members.push(pair.player_a_text)
  }
  if (pair.player_b_user_id) {
    members.push(pair.player_b_display_name ?? 'Jugador registrado')
  } else if (pair.player_b_text) {
    members.push(pair.player_b_text)
  }
  return members
}

export function pairHasOpenSlot(pair: TournamentPairRow): 'a' | 'b' | null {
  const aFree = !pair.player_a_user_id && !pair.player_a_text
  const bFree = !pair.player_b_user_id && !pair.player_b_text
  if (aFree) return 'a'
  if (bFree) return 'b'
  return null
}

function mapTournamentPairRpcError(message: string): string {
  if (message.includes('already_in_pair')) {
    return 'Ya estás inscrito en otra pareja de este torneo'
  }
  if (message.includes('slot_taken')) {
    return 'Esa plaza ya está ocupada'
  }
  if (message.includes('tournament_not_in_registration')) {
    return 'El torneo ya no acepta inscripciones'
  }
  return message
}

/** Pair id where the user is registered as player A or B, if any. */
export function findUserTournamentPairId(
  pairs: TournamentPairRow[],
  userId: string
): string | null {
  for (const pair of pairs) {
    if (pair.player_a_user_id === userId || pair.player_b_user_id === userId) {
      return pair.id
    }
  }
  return null
}

export function userIsInTournamentPair(pairs: TournamentPairRow[], userId: string): boolean {
  return findUserTournamentPairId(pairs, userId) !== null
}

export function canJoinTournamentPair(
  pair: TournamentPairRow,
  userId: string | undefined,
  pairs: TournamentPairRow[],
  inRegistration: boolean
): { canJoin: boolean; openSlot: 'a' | 'b' | null } {
  const openSlot = inRegistration ? pairHasOpenSlot(pair) : null
  if (!userId || !openSlot || pair.created_by_user_id === userId) {
    return { canJoin: false, openSlot }
  }

  const userPairId = findUserTournamentPairId(pairs, userId)
  if (userPairId !== null) {
    return { canJoin: false, openSlot }
  }

  return { canJoin: true, openSlot }
}
