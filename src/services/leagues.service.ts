import { trackMatchCompletedOnce } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { mapResultRpcError } from '@/services/results.service'
import {
  DEFAULT_ELO_INITIAL,
  DEFAULT_ELO_K_FACTOR,
  LEAGUE_FORMAT,
  LEAGUE_STATUS,
  MATCH_STATUS,
  MATCH_VISIBILITY,
  type ExploreContentType,
  type LeagueFormat,
} from '@/constants'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

/** Mirrors matches.service VisibilityFilter — kept local to avoid circular imports. */
type VisibilityFilter = 'all' | 'public' | 'private'
import { formatTeamNameFromPlayers } from '@/utils/matchTeamNames'

function startAtToTimestamptzIso(startAt: string): string {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Fecha no válida')
  }
  return d.toISOString()
}

export type LeagueRow = Tables<'leagues'>
export type LeaguePairRow = Tables<'league_pairs'> & {
  player_a_display_name?: string | null
  player_b_display_name?: string | null
}
export type LeagueChallengeRow = Tables<'league_challenges'> & {
  challenger_name?: string | null
  challenged_name?: string | null
}

export type LeagueInsert = Pick<
  TablesInsert<'leagues'>,
  | 'title'
  | 'description'
  | 'notes'
  | 'start_at'
  | 'end_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
  | 'location_privacy'
  | 'format'
> & {
  elo_initial?: number
  elo_k_factor?: number
}

export type LeagueUpdate = Pick<
  TablesUpdate<'leagues'>,
  | 'title'
  | 'description'
  | 'notes'
  | 'start_at'
  | 'end_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
  | 'format'
>

export type LeagueWithPairs = LeagueRow & {
  pairs: LeaguePairRow[]
  organizer_display_name?: string | null
  viewer_has_full_access?: boolean
}

export type LeagueStandingRow = {
  pair_id: string
  pair_name: string
  played: number
  wins: number
  losses: number
  games_for: number
  games_against: number
  games_diff: number
  h2h_wins: number
  current_elo: number
  rank: number
}

export type LeagueMatchRow = {
  match_id: string
  title: string
  start_at: string
  status: string
  pair_a_id: string | null
  pair_a_name: string | null
  pair_b_id: string | null
  pair_b_name: string | null
  round_number: number | null
  is_second_leg: boolean
  team_a_games: number | null
  team_b_games: number | null
}

export type AddLeaguePairInput = {
  leagueId: string
  name?: string
  playerAUserId?: string | null
  playerAText?: string | null
  playerBUserId?: string | null
  playerBText?: string | null
}

export type UpdateLeaguePairInput = {
  pairId: string
  name?: string
  playerAText?: string | null
  playerBText?: string | null
}

export async function createLeague(
  _userId: string,
  data: LeagueInsert,
  password?: string
): Promise<LeagueRow> {
  const format = (data.format ?? LEAGUE_FORMAT.SINGLE_ROUND) as LeagueFormat
  if (format === LEAGUE_FORMAT.OPEN_ELO && !data.end_at) {
    throw new Error('La liga abierta requiere fecha de fin')
  }

  const { data: row, error } = await supabase.rpc('create_league', {
    p_title: data.title,
    p_start_at: startAtToTimestamptzIso(data.start_at),
    p_city: data.city,
    p_duration_target_games: data.duration_target_games,
    p_format: format,
    p_end_at: data.end_at ? startAtToTimestamptzIso(data.end_at) : undefined,
    p_description: data.description ?? undefined,
    p_notes: data.notes ?? undefined,
    p_place_defined: data.place_defined,
    p_place_text: data.place_text ?? undefined,
    p_visibility: data.visibility,
    p_location_privacy: data.location_privacy,
    p_elo_initial: data.elo_initial ?? DEFAULT_ELO_INITIAL,
    p_elo_k_factor: data.elo_k_factor ?? DEFAULT_ELO_K_FACTOR,
  })

  if (error) throw new Error(mapLeagueRpcError(error.message))
  if (!row) throw new Error('No se pudo crear la liga')

  const league = row as LeagueRow
  if (data.visibility === MATCH_VISIBILITY.PRIVATE && password?.trim()) {
    await setLeaguePassword(league.id, password.trim())
  }

  return league
}

export async function getLeague(id: string): Promise<LeagueWithPairs> {
  const { data: league, error } = await supabase
    .from('leagues')
    .select(
      `*,
      creator_profile:profiles!leagues_creator_id_fkey(display_name)`
    )
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)

  const leagueRow = league as LeagueRow & {
    creator_profile?: { display_name: string } | null
  }

  let viewerHasFullAccess = leagueRow.visibility !== MATCH_VISIBILITY.PRIVATE
  if (leagueRow.visibility === MATCH_VISIBILITY.PRIVATE) {
    const { data: canAccess, error: accessError } = await supabase.rpc('viewer_can_access_league', {
      p_league_id: id,
    })
    if (accessError) throw new Error(accessError.message)
    viewerHasFullAccess = Boolean(canAccess)
  }

  if (!viewerHasFullAccess) {
    return {
      ...(leagueRow as LeagueRow),
      organizer_display_name: leagueRow.creator_profile?.display_name ?? null,
      pairs: [],
      viewer_has_full_access: false,
    }
  }

  const { data: pairs, error: pairsError } = await supabase
    .from('league_pairs')
    .select(
      `*,
      player_a_profile:profiles!league_pairs_player_a_user_id_fkey(display_name),
      player_b_profile:profiles!league_pairs_player_b_user_id_fkey(display_name)`
    )
    .eq('league_id', id)
    .order('created_at', { ascending: true })

  if (pairsError) throw new Error(pairsError.message)

  const mappedPairs = (pairs ?? []).map((row) => {
    const r = row as LeaguePairRow & {
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
    ...(leagueRow as LeagueRow),
    organizer_display_name: leagueRow.creator_profile?.display_name ?? null,
    pairs: mappedPairs,
    viewer_has_full_access: true,
  }
}

export async function updateLeague(
  id: string,
  data: LeagueUpdate,
  password?: string
): Promise<LeagueRow> {
  const payload: LeagueUpdate = { ...data }
  if (data.start_at !== undefined) {
    payload.start_at = startAtToTimestamptzIso(data.start_at)
  }
  if (data.end_at !== undefined && data.end_at) {
    payload.end_at = startAtToTimestamptzIso(data.end_at)
  }

  const { data: row, error } = await supabase.from('leagues').update(payload).eq('id', id).select().single()

  if (error) throw new Error(error.message)

  if (data.visibility === MATCH_VISIBILITY.PRIVATE && password?.trim()) {
    await setLeaguePassword(id, password.trim())
  }

  return row as LeagueRow
}

export async function cancelLeague(id: string): Promise<LeagueRow> {
  const { data, error } = await supabase.rpc('cancel_league', { p_league_id: id })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeagueRow
}

export async function setLeaguePassword(leagueId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('set_league_password', {
    p_league_id: leagueId,
    p_password: password,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
}

export async function grantLeaguePasswordAccess(leagueId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('grant_league_password_access', {
    p_league_id: leagueId,
    p_password: password,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
}

export async function addLeaguePair(input: AddLeaguePairInput): Promise<LeaguePairRow> {
  const { data, error } = await supabase.rpc('add_league_pair', {
    p_league_id: input.leagueId,
    p_name: input.name?.trim() ?? '',
    p_player_a_user_id: input.playerAUserId ?? undefined,
    p_player_a_text: input.playerAText ?? undefined,
    p_player_b_user_id: input.playerBUserId ?? undefined,
    p_player_b_text: input.playerBText ?? undefined,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeaguePairRow
}

export async function joinLeaguePair(
  pairId: string,
  slot: 'a' | 'b',
  asText?: string | null
): Promise<LeaguePairRow> {
  const { data, error } = await supabase.rpc('join_league_pair', {
    p_pair_id: pairId,
    p_slot: slot,
    p_as_text: asText ?? undefined,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeaguePairRow
}

export async function updateLeaguePair(input: UpdateLeaguePairInput): Promise<LeaguePairRow> {
  const { data, error } = await supabase.rpc('update_league_pair', {
    p_pair_id: input.pairId,
    p_name: input.name?.trim() ?? '',
    p_player_a_text: input.playerAText ?? '',
    p_player_b_text: input.playerBText ?? '',
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeaguePairRow
}

export async function removeLeaguePair(pairId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_league_pair', { p_pair_id: pairId })
  if (error) throw new Error(mapLeagueRpcError(error.message))
}

export async function generateLeagueFixtures(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('generate_league_fixtures', { p_league_id: leagueId })
  if (error) throw new Error(mapLeagueRpcError(error.message))
}

export async function startOpenLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('start_open_league', { p_league_id: leagueId })
  if (error) throw new Error(mapLeagueRpcError(error.message))
}

export async function startLeague(leagueId: string, format: string): Promise<void> {
  if (format === LEAGUE_FORMAT.OPEN_ELO) {
    await startOpenLeague(leagueId)
  } else {
    await generateLeagueFixtures(leagueId)
  }
}

export async function listLeagueStandings(leagueId: string): Promise<LeagueStandingRow[]> {
  const { data, error } = await supabase.rpc('list_league_standings', { p_league_id: leagueId })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return (data ?? []) as LeagueStandingRow[]
}

export async function listLeagueMatches(leagueId: string): Promise<LeagueMatchRow[]> {
  const { data, error } = await supabase.rpc('list_league_matches', { p_league_id: leagueId })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return (data ?? []) as LeagueMatchRow[]
}

export async function listLeagueChallenges(leagueId: string): Promise<LeagueChallengeRow[]> {
  const { data, error } = await supabase
    .from('league_challenges')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const challenges = (data ?? []) as Tables<'league_challenges'>[]
  if (challenges.length === 0) return []

  const pairIds = Array.from(
    new Set(challenges.flatMap((c) => [c.challenger_pair_id, c.challenged_pair_id]))
  )
  const { data: pairs, error: pairsError } = await supabase
    .from('league_pairs')
    .select('id, name')
    .in('id', pairIds)

  if (pairsError) throw new Error(pairsError.message)

  const nameById = new Map((pairs ?? []).map((p) => [p.id, p.name]))

  return challenges.map((row) => ({
    ...row,
    challenger_name: nameById.get(row.challenger_pair_id) ?? null,
    challenged_name: nameById.get(row.challenged_pair_id) ?? null,
  }))
}

export async function createLeagueChallenge(
  leagueId: string,
  challengedPairId: string
): Promise<LeagueChallengeRow> {
  const { data, error } = await supabase.rpc('create_league_challenge', {
    p_league_id: leagueId,
    p_challenged_pair_id: challengedPairId,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeagueChallengeRow
}

export async function acceptLeagueChallenge(challengeId: string): Promise<LeagueChallengeRow> {
  const { data, error } = await supabase.rpc('accept_league_challenge', {
    p_challenge_id: challengeId,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeagueChallengeRow
}

export async function rejectLeagueChallenge(challengeId: string): Promise<LeagueChallengeRow> {
  const { data, error } = await supabase.rpc('reject_league_challenge', {
    p_challenge_id: challengeId,
  })
  if (error) throw new Error(mapLeagueRpcError(error.message))
  return data as LeagueChallengeRow
}

export async function recordLeagueMatchAsReferee(
  matchId: string,
  teamAGames: number,
  teamBGames: number
): Promise<void> {
  const { error } = await supabase.rpc('record_league_match_result_as_referee', {
    p_match_id: matchId,
    p_team_a_games: teamAGames,
    p_team_b_games: teamBGames,
  })
  if (error) throw new Error(mapResultRpcError(error.message))
  void trackMatchCompletedOnce(matchId).catch(() => {
    /* analytics must not block */
  })
}

export type PublicLeaguesListFilters = {
  search: string
  city: string
  status: string | null
  hideCelebrated: boolean
  startAfter: string | null
  startBefore: string | null
  minFreeSlots: number
  contentType: ExploreContentType
  visibility: VisibilityFilter
}

export type UserLeagueSummary = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  city: string
  place_defined: boolean
  place_text: string | null
  status: string
  format: string
  creator_id: string
  fixtures_generated_at: string | null
  isOrganizer: boolean
}

function leagueStatusesFromExploreFilter(matchStatus: string | null): string[] | null {
  if (!matchStatus) return null
  switch (matchStatus) {
    case MATCH_STATUS.PLANNED:
      return [LEAGUE_STATUS.REGISTRATION]
    case MATCH_STATUS.IN_PROGRESS:
      return [LEAGUE_STATUS.IN_PROGRESS]
    case MATCH_STATUS.FINISHED:
    case MATCH_STATUS.FINISHED_NO_RESULT:
      return [LEAGUE_STATUS.FINISHED]
    default:
      return []
  }
}

export async function listPublicLeaguesFiltered(
  filters: PublicLeaguesListFilters,
  limit = 50
): Promise<LeagueRow[]> {
  if (filters.minFreeSlots > 0) return []

  const statuses = leagueStatusesFromExploreFilter(filters.status)
  if (statuses !== null && statuses.length === 0) return []

  let query = supabase.from('leagues').select('*').neq('status', LEAGUE_STATUS.CANCELLED)

  const visibility = filters.visibility ?? 'all'
  if (visibility === 'public') {
    query = query.eq('visibility', 'public')
  } else if (visibility === 'private') {
    query = query.eq('visibility', 'private')
  } else {
    query = query.in('visibility', ['public', 'private'])
  }

  const city = filters.city.trim()
  if (city) query = query.ilike('city', `%${city}%`)

  const search = filters.search.trim()
  if (search) query = query.ilike('title', `%${search}%`)

  if (filters.hideCelebrated) {
    query = query.neq('status', LEAGUE_STATUS.FINISHED)
  }

  if (filters.startAfter) {
    if (filters.hideCelebrated) {
      const cutoff = filters.startAfter
      query = query.or(
        `start_at.gte."${cutoff}",and(start_at.lt."${cutoff}",status.in.(${LEAGUE_STATUS.REGISTRATION},${LEAGUE_STATUS.IN_PROGRESS}))`
      )
    } else {
      query = query.gte('start_at', filters.startAfter)
    }
  }
  if (filters.startBefore) query = query.lte('start_at', filters.startBefore)
  if (statuses) query = query.in('status', statuses)

  const { data, error } = await query.order('start_at', { ascending: true }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as LeagueRow[]
}

export async function getUserLeaguesDashboard(userId: string): Promise<{
  upcoming: UserLeagueSummary[]
  inProgress: UserLeagueSummary[]
}> {
  const [createdRes, pairsRes] = await Promise.all([
    supabase
      .from('leagues')
      .select(
        'id, title, start_at, end_at, city, place_defined, place_text, status, format, creator_id, fixtures_generated_at'
      )
      .eq('creator_id', userId)
      .neq('status', LEAGUE_STATUS.CANCELLED),
    supabase
      .from('league_pairs')
      .select(
        `league:leagues(id, title, start_at, end_at, city, place_defined, place_text, status, format, creator_id, fixtures_generated_at)`
      )
      .or(`player_a_user_id.eq.${userId},player_b_user_id.eq.${userId}`),
  ])

  if (createdRes.error) throw new Error(createdRes.error.message)
  if (pairsRes.error) throw new Error(pairsRes.error.message)

  type LeagueBrief = Omit<UserLeagueSummary, 'isOrganizer'>
  const byId = new Map<string, UserLeagueSummary>()

  for (const row of (createdRes.data ?? []) as LeagueBrief[]) {
    byId.set(row.id, { ...row, isOrganizer: true })
  }

  for (const row of pairsRes.data ?? []) {
    const l = row.league as LeagueBrief | null
    if (!l || l.status === LEAGUE_STATUS.CANCELLED) continue
    if (!byId.has(l.id)) {
      byId.set(l.id, { ...l, isOrganizer: l.creator_id === userId })
    }
  }

  const all = Array.from(byId.values())
  const upcoming = all
    .filter((l) => l.status === LEAGUE_STATUS.REGISTRATION)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  const inProgress = all
    .filter((l) => l.status === LEAGUE_STATUS.IN_PROGRESS)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  return { upcoming, inProgress }
}

export function isLeaguePairComplete(pair: LeaguePairRow): boolean {
  const hasA = Boolean(pair.player_a_user_id || pair.player_a_text?.trim())
  const hasB = Boolean(pair.player_b_user_id || pair.player_b_text?.trim())
  return hasA && hasB
}

export function displayLeaguePairName(pair: LeaguePairRow): string {
  const stored = pair.name?.trim() || ''
  if (pair.name_is_custom && stored) return stored
  const fromMembers = formatTeamNameFromPlayers(leaguePairMemberLabels(pair))
  if (fromMembers) return fromMembers
  return stored || 'Pareja'
}

export function leaguePairMemberLabels(pair: LeaguePairRow): string[] {
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

export function leaguePairHasOpenSlot(pair: LeaguePairRow): 'a' | 'b' | null {
  const aFree = !pair.player_a_user_id && !pair.player_a_text
  const bFree = !pair.player_b_user_id && !pair.player_b_text
  if (aFree) return 'a'
  if (bFree) return 'b'
  return null
}

export function findUserLeaguePairId(pairs: LeaguePairRow[], userId: string): string | null {
  for (const pair of pairs) {
    if (pair.player_a_user_id === userId || pair.player_b_user_id === userId) {
      return pair.id
    }
  }
  return null
}

export function userIsInLeaguePair(pairs: LeaguePairRow[], userId: string): boolean {
  return findUserLeaguePairId(pairs, userId) !== null
}

export function userIsLeaguePairMember(pair: LeaguePairRow, userId: string | undefined): boolean {
  if (!userId) return false
  return pair.player_a_user_id === userId || pair.player_b_user_id === userId
}

export function canEditLeaguePair(
  pair: LeaguePairRow,
  userId: string | undefined,
  isCreator: boolean,
  leagueStatus: string
): boolean {
  if (!userId) return false
  if (leagueStatus !== LEAGUE_STATUS.REGISTRATION && leagueStatus !== LEAGUE_STATUS.IN_PROGRESS) {
    return false
  }
  return isCreator || userIsLeaguePairMember(pair, userId)
}

export function canJoinLeaguePair(
  pair: LeaguePairRow,
  userId: string | undefined,
  pairs: LeaguePairRow[],
  leagueStatus: string
): { canJoin: boolean; openSlot: 'a' | 'b' | null } {
  const accepting =
    leagueStatus === LEAGUE_STATUS.REGISTRATION || leagueStatus === LEAGUE_STATUS.IN_PROGRESS
  const openSlot = accepting ? leaguePairHasOpenSlot(pair) : null
  if (!userId || !openSlot) return { canJoin: false, openSlot }
  if (pair.player_a_user_id === userId || pair.player_b_user_id === userId) {
    return { canJoin: false, openSlot }
  }
  const userPairId = findUserLeaguePairId(pairs, userId)
  if (userPairId !== null && userPairId !== pair.id) {
    return { canJoin: false, openSlot }
  }
  return { canJoin: true, openSlot }
}

function mapLeagueRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'Debes iniciar sesión'
  if (message.includes('end_at_required_for_open_elo')) {
    return 'La liga abierta requiere fecha de fin'
  }
  if (message.includes('end_at_must_be_after_start_at')) {
    return 'La fecha de fin debe ser posterior al inicio'
  }
  if (message.includes('need_at_least_two_complete_pairs')) {
    return 'Se necesitan al menos 2 parejas completas para iniciar la liga'
  }
  if (message.includes('fixtures_already_generated')) {
    return 'Los enfrentamientos ya están generados'
  }
  if (message.includes('fixtures_only_for_round_robin')) {
    return 'Solo las ligas de ida o ida y vuelta generan calendario'
  }
  if (message.includes('league_ended')) return 'La liga ha finalizado'
  if (message.includes('league_not_in_progress')) return 'La liga no está en curso'
  if (message.includes('league_not_accepting_pairs')) {
    return 'La liga ya no acepta parejas'
  }
  if (message.includes('already_in_pair')) {
    return 'Ya estás inscrito en otra pareja de esta liga'
  }
  if (message.includes('slot_taken')) return 'Esa plaza ya está ocupada'
  if (message.includes('challenge_already_pending')) {
    return 'Ya hay un desafío pendiente entre estas parejas'
  }
  if (message.includes('cannot_challenge_self')) return 'No puedes desafiar a tu propia pareja'
  if (message.includes('not_in_league_pair')) {
    return 'Debes pertenecer a una pareja de la liga para desafiar'
  }
  if (message.includes('forbidden')) return 'No tienes permiso para esta acción'
  if (message.includes('wrong_password')) return 'Contraseña incorrecta'
  if (message.includes('password_empty')) return 'La contraseña no puede estar vacía'
  if (message.includes('league_not_cancellable')) return 'Esta liga ya no se puede cancelar'
  if (message.includes('cannot_remove_pair_after_start')) {
    return 'No se pueden eliminar parejas una vez iniciada la liga'
  }
  if (message.includes('cannot_clear_text_player')) {
    return 'No puedes quitar jugadores de la pareja; solo editar el nombre'
  }
  if (message.includes('pair_not_found')) return 'La pareja ya no existe'
  if (message.includes('league_not_found')) return 'Liga no encontrada'
  return message
}
