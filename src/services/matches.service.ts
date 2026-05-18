import { supabase } from '@/lib/supabase'
import {
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  MATCH_STATUS,
  MAX_PLAYERS_PER_TEAM,
  MATCH_PAGE_SIZE,
  RESULT_STATUS,
  TEAM,
} from '@/constants'
import type { Database, TablesInsert, TablesUpdate } from '@/types/database.types'

/** `timestamptz` must receive an explicit instant; bare local strings are parsed as UTC on Supabase. */
function startAtToTimestamptzIso(startAt: string): string {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Fecha de inicio no válida')
  }
  return d.toISOString()
}

function isMissingPostgrestRpcError(error: {
  message?: string
  code?: string
  details?: string
  status?: number
}): boolean {
  if (error.status === 404) return true
  const msg = (error.message ?? '').toLowerCase()
  const details = (error.details ?? '').toLowerCase()
  const code = error.code ?? ''
  if (code === 'PGRST202' || code === '42883') return true
  if (/could not find.*function|schema cache/.test(msg)) return true
  if (msg.includes('404') || details.includes('404')) return true
  return false
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchRow = {
  id: string
  title: string
  description: string | null
  start_at: string
  city: string
  place_defined: boolean
  place_text: string | null
  duration_target_games: number
  visibility: string
  location_privacy: string
  status: string
  creator_id: string
  team_a_name: string
  team_a_player_1: string | null
  team_a_player_2: string | null
  team_b_name: string
  team_b_player_1: string | null
  team_b_player_2: string | null
  created_at: string
  updated_at: string
}

export type ParticipantRow = {
  id: string
  match_id: string
  user_id: string
  team: string
  state: string
  joined_at: string
  left_at: string | null
}

export type ParticipantProfile = {
  id: string
  display_name: string
  photo_url: string | null
  city: string | null
  phone_e164: string | null
}

export type ParticipantWithProfile = ParticipantRow & {
  profile: ParticipantProfile
}

export type MatchWithParticipants = MatchRow & {
  participants: ParticipantWithProfile[]
}

export type MatchInsert = Pick<
  TablesInsert<'matches'>,
  | 'title'
  | 'description'
  | 'start_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
  | 'location_privacy'
  | 'team_a_name'
  | 'team_a_player_1'
  | 'team_a_player_2'
  | 'team_b_name'
  | 'team_b_player_1'
  | 'team_b_player_2'
>

export type MatchUpdate = Pick<
  TablesUpdate<'matches'>,
  | 'title'
  | 'description'
  | 'start_at'
  | 'city'
  | 'place_defined'
  | 'place_text'
  | 'duration_target_games'
  | 'visibility'
  | 'team_a_name'
  | 'team_a_player_1'
  | 'team_a_player_2'
  | 'team_b_name'
  | 'team_b_player_1'
  | 'team_b_player_2'
>

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns active participants only (left_at IS NULL). */
function activeParticipants(participants: ParticipantWithProfile[]) {
  return participants.filter((p) => p.left_at === null)
}

/** Count confirmed slots for a given team among active participants. */
export function countTeamSlots(participants: ParticipantWithProfile[], team: string): number {
  return activeParticipants(participants).filter((p) => p.team === team).length
}

type TextPlayerFields = Pick<
  MatchRow,
  'team_a_player_1' | 'team_a_player_2' | 'team_b_player_1' | 'team_b_player_2'
>

function textPlayerNamesOnTeam(match: TextPlayerFields, team: string): string[] {
  const slots =
    team === TEAM.B
      ? [match.team_b_player_1, match.team_b_player_2]
      : [match.team_a_player_1, match.team_a_player_2]
  return slots.map((s) => s?.trim()).filter((s): s is string => Boolean(s))
}

/** Free seats on a team (registered + text names count toward the 2 per team). */
export function freeTeamSlots(
  match: TextPlayerFields,
  participants: ParticipantWithProfile[],
  team: string
): number {
  const registered = countTeamSlots(participants, team)
  const textCount = textPlayerNamesOnTeam(match, team).length
  return Math.max(0, MAX_PLAYERS_PER_TEAM - registered - textCount)
}

/** Max text-name fields allowed on a team given registered participants. */
export function maxTextSlotsForTeam(participants: ParticipantWithProfile[], team: string): number {
  return Math.max(0, MAX_PLAYERS_PER_TEAM - countTeamSlots(participants, team))
}

export type EditableTextPlayerField = 'team_a_player_2' | 'team_b_player_1' | 'team_b_player_2'

const TEXT_SLOTS_BY_TEAM: Record<string, EditableTextPlayerField[]> = {
  [TEAM.A]: ['team_a_player_2'],
  [TEAM.B]: ['team_b_player_1', 'team_b_player_2'],
}

/** Text fields that may be edited without exceeding the 2-per-team roster cap. */
export function editableTextSlotsForTeam(
  participants: ParticipantWithProfile[],
  team: string,
  current: TextPlayerFields
): EditableTextPlayerField[] {
  const keys = TEXT_SLOTS_BY_TEAM[team] ?? []
  const max = maxTextSlotsForTeam(participants, team)
  if (max <= 0) return []
  if (max >= keys.length) return keys

  const withValues = keys.filter((k) => current[k]?.trim())
  if (withValues.length > max) return withValues
  const without = keys.filter((k) => !current[k]?.trim())
  return [...withValues, ...without].slice(0, max)
}

/** Returns a user-facing error when registered + text players exceed the team cap. */
export function validateTextRosterCapacity(
  participants: ParticipantWithProfile[],
  textFields: TextPlayerFields,
  teamNames?: Pick<MatchRow, 'team_a_name' | 'team_b_name'>
): string | null {
  for (const team of [TEAM.A, TEAM.B]) {
    const registered = countTeamSlots(participants, team)
    const textCount = textPlayerNamesOnTeam(textFields, team).length
    if (registered + textCount > MAX_PLAYERS_PER_TEAM) {
      const label = teamNames ? resolveTeamName(teamNames, team) : `equipo ${team}`
      return `${label} ya está completo; no puedes añadir más jugadores por nombre.`
    }
  }
  return null
}

const TEXT_PLAYER_UPDATE_KEYS = [
  'team_a_player_1',
  'team_a_player_2',
  'team_b_player_1',
  'team_b_player_2',
] as const satisfies ReadonlyArray<keyof TextPlayerFields>

export function resolveTeamName(
  match: Pick<MatchRow, 'team_a_name' | 'team_b_name'>,
  team: string
): string {
  if (team === TEAM.B) {
    const name = match.team_b_name?.trim()
    return name || DEFAULT_TEAM_B_NAME
  }
  const name = match.team_a_name?.trim()
  return name || DEFAULT_TEAM_A_NAME
}

// ─── Match CRUD ───────────────────────────────────────────────────────────────

export async function createMatch(userId: string, data: MatchInsert): Promise<MatchRow> {
  const { data: row, error } = await supabase
    .from('matches')
    .insert({ ...data, start_at: startAtToTimestamptzIso(data.start_at), creator_id: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)

  try {
    await joinMatch(row.id, userId, TEAM.A)
  } catch (joinErr) {
    throw joinErr instanceof Error
      ? joinErr
      : new Error('No se pudo añadirte como jugador del equipo A')
  }

  return row as MatchRow
}

/**
 * Fetch a single match together with all its participants and their basic
 * profile info (display_name, photo_url, city).
 * Phone numbers are NOT included — use getParticipantProfile() for that.
 * Roster comes from RPC `list_match_participant_display` so non-members can see names without phone.
 */
export async function getMatch(id: string): Promise<MatchWithParticipants> {
  const { data: raw, error } = await supabase.from('matches').select('*').eq('id', id).single()

  if (error) throw new Error(error.message)

  const { data: roster, error: rosterError } = await supabase.rpc(
    'list_match_participant_display',
    {
      p_match_id: id,
    }
  )

  let participants: ParticipantWithProfile[]

  if (rosterError) {
    if (!isMissingPostgrestRpcError(rosterError)) {
      throw new Error(rosterError.message)
    }
    const { data: nested, error: nestedError } = await supabase
      .from('matches')
      .select(
        `*,
         participants:match_participants(
           id, match_id, user_id, team, state, joined_at, left_at,
           profile:profiles(id, display_name, photo_url, city)
         )`
      )
      .eq('id', id)
      .single()
    if (nestedError) throw new Error(nestedError.message)
    const rawNested = nested as MatchRow & {
      participants: Array<ParticipantRow & { profile: ParticipantProfile | null }>
    }
    participants = (rawNested.participants ?? []).map((p) => ({
      ...p,
      profile: p.profile ?? {
        id: p.user_id,
        display_name: 'Usuario',
        photo_url: null,
        city: null,
        phone_e164: null,
      },
    }))
  } else {
    type RosterRow = {
      participant_id: string
      match_id: string
      user_id: string
      team: string
      state: string
      joined_at: string
      left_at: string | null
      display_name: string
      photo_url: string | null
      city: string | null
    }

    participants = ((roster ?? []) as RosterRow[]).map((r) => ({
      id: r.participant_id,
      match_id: r.match_id,
      user_id: r.user_id,
      team: r.team,
      state: r.state,
      joined_at: r.joined_at,
      left_at: r.left_at,
      profile: {
        id: r.user_id,
        display_name: r.display_name,
        photo_url: r.photo_url,
        city: r.city,
        phone_e164: null,
      },
    }))
  }

  return { ...(raw as MatchRow), participants }
}

export async function updateMatch(id: string, data: MatchUpdate): Promise<MatchRow> {
  const touchesTextPlayers = TEXT_PLAYER_UPDATE_KEYS.some((k) => k in data)

  if (touchesTextPlayers) {
    const current = await getMatch(id)
    const mergedText: TextPlayerFields = {
      team_a_player_1:
        'team_a_player_1' in data ? (data.team_a_player_1 ?? null) : current.team_a_player_1,
      team_a_player_2:
        'team_a_player_2' in data ? (data.team_a_player_2 ?? null) : current.team_a_player_2,
      team_b_player_1:
        'team_b_player_1' in data ? (data.team_b_player_1 ?? null) : current.team_b_player_1,
      team_b_player_2:
        'team_b_player_2' in data ? (data.team_b_player_2 ?? null) : current.team_b_player_2,
    }
    const rosterError = validateTextRosterCapacity(current.participants, mergedText, current)
    if (rosterError) throw new Error(rosterError)
  }

  const payload: MatchUpdate =
    data.start_at !== undefined
      ? { ...data, start_at: startAtToTimestamptzIso(data.start_at) }
      : data

  const { data: row, error } = await supabase
    .from('matches')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row as MatchRow
}

export async function cancelMatch(id: string): Promise<MatchRow> {
  const { data: row, error } = await supabase
    .from('matches')
    .update({ status: MATCH_STATUS.CANCELLED })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row as MatchRow
}

// ─── Participants ─────────────────────────────────────────────────────────────

function throwJoinMatchError(error: { message?: string; code?: string }, team: string): never {
  const msg = error.message ?? ''
  if (msg.includes('max_players') || msg.includes('team_capacity') || error.code === '23514') {
    throw new Error(`El equipo ${team} ya tiene ${MAX_PLAYERS_PER_TEAM} jugadores.`)
  }
  if (error.code === '23505') {
    throw new Error('Ya participas en esta partida.')
  }
  throw new Error(msg)
}

/**
 * Join a match for a given team.
 * Re-activates a prior row if the user had left (unique on match_id + user_id).
 * The DB trigger ensures max MAX_PLAYERS_PER_TEAM per team.
 */
export async function joinMatch(
  matchId: string,
  userId: string,
  team: string
): Promise<ParticipantRow> {
  const { data: existing, error: lookupError } = await supabase
    .from('match_participants')
    .select('id, left_at, state')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)

  if (existing && existing.left_at === null && existing.state === 'confirmed') {
    throw new Error('Ya participas en esta partida.')
  }

  if (existing) {
    const { data, error } = await supabase
      .from('match_participants')
      .update({
        team,
        state: 'confirmed',
        left_at: null,
        joined_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throwJoinMatchError(error, team)
    return data as ParticipantRow
  }

  const { data, error } = await supabase
    .from('match_participants')
    .insert({ match_id: matchId, user_id: userId, team })
    .select()
    .single()

  if (error) throwJoinMatchError(error, team)
  return data as ParticipantRow
}

/** Leave a match (set left_at = now, state = 'left'). */
export async function leaveMatch(matchId: string, userId: string): Promise<ParticipantRow> {
  const { data, error } = await supabase
    .from('match_participants')
    .update({ left_at: new Date().toISOString(), state: 'left' })
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .is('left_at', null)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ParticipantRow
}

// ─── Profile with phone (RLS-protected) ──────────────────────────────────────

/**
 * Fetch a participant's profile including phone_e164.
 * The RPC enforces that the caller must be a confirmed participant of the same match.
 */
export async function getParticipantProfile(
  matchId: string,
  profileId: string
): Promise<ParticipantProfile | null> {
  const { data, error } = await supabase.rpc('get_profile_with_phone', {
    p_match_id: matchId,
    p_profile_id: profileId,
  })

  if (error) return null
  if (!data || data.length === 0) return null

  const row = data[0]
  return {
    id: row.id,
    display_name: row.display_name,
    photo_url: row.photo_url,
    city: row.city,
    phone_e164: row.phone_e164,
  }
}

// ─── User match history ───────────────────────────────────────────────────────

export type UserMatchSummary = {
  id: string
  title: string
  start_at: string
  city: string
  status: string
  visibility: string
  creator_id: string
}

/**
 * Fetch all matches where the user is the creator OR an active participant.
 * Returns a flat list of match summaries sorted by start_at descending.
 */
export async function getUserMatches(userId: string): Promise<UserMatchSummary[]> {
  const [asCreator, asParticipant] = await Promise.all([
    supabase
      .from('matches')
      .select('id, title, start_at, city, status, visibility, creator_id')
      .eq('creator_id', userId)
      .order('start_at', { ascending: false })
      .limit(MATCH_PAGE_SIZE),

    supabase
      .from('match_participants')
      .select(`match:matches(id, title, start_at, city, status, visibility, creator_id)`)
      .eq('user_id', userId)
      .is('left_at', null)
      .limit(MATCH_PAGE_SIZE),
  ])

  if (asCreator.error) throw new Error(asCreator.error.message)
  if (asParticipant.error) throw new Error(asParticipant.error.message)

  const creatorRows = (asCreator.data ?? []) as UserMatchSummary[]

  const participantRows = (asParticipant.data ?? [])
    .map((r) => {
      const m = r.match as UserMatchSummary | null
      return m
    })
    .filter((m): m is UserMatchSummary => m !== null)

  // Merge, deduplicate by id, sort by start_at desc
  const byId = new Map<string, UserMatchSummary>()
  for (const m of [...creatorRows, ...participantRows]) {
    byId.set(m.id, m)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  )
}

/** Row from `list_matches_awaiting_my_result_action` — same shape as `UserMatchSummary` + result id. */
export type AwaitingResultMatchRow = UserMatchSummary & { match_result_id: string }

export type MyMatchesDashboard = {
  upcoming: UserMatchSummary[]
  inProgress: UserMatchSummary[]
  awaitingResultValidation: AwaitingResultMatchRow[]
}

/**
 * Same logic as `list_matches_awaiting_my_result_action` when that RPC is not yet applied on the
 * Supabase project (avoids 404 breaking «Mis partidas»).
 */
async function listAwaitingResultValidationClientFallback(
  userId: string
): Promise<AwaitingResultMatchRow[]> {
  const { data: parts, error: partsError } = await supabase
    .from('match_participants')
    .select('match_id, team')
    .eq('user_id', userId)
    .eq('state', 'confirmed')
    .is('left_at', null)

  if (partsError) throw new Error(partsError.message)

  const teamByMatch = new Map<string, string>()
  for (const row of parts ?? []) {
    teamByMatch.set(row.match_id, row.team)
  }
  const matchIds = [...teamByMatch.keys()]
  if (matchIds.length === 0) return []

  const { data: pendingRows, error: resultsError } = await supabase
    .from('match_results')
    .select(
      `id, match_id, submitted_by_team, created_at,
       match:matches(id, title, start_at, city, status, visibility, creator_id)`
    )
    .in('match_id', matchIds)
    .eq('status', RESULT_STATUS.PENDING_VALIDATION)
    .order('created_at', { ascending: false })

  if (resultsError) throw new Error(resultsError.message)

  type PendingRow = {
    id: string
    match_id: string
    submitted_by_team: string
    match: UserMatchSummary | null
  }

  const latestByMatch = new Map<string, PendingRow>()
  for (const row of (pendingRows ?? []) as PendingRow[]) {
    if (!latestByMatch.has(row.match_id)) {
      latestByMatch.set(row.match_id, row)
    }
  }

  const resultIds = [...latestByMatch.values()].map((r) => r.id)
  if (resultIds.length === 0) return []

  const { data: confs, error: confError } = await supabase
    .from('result_confirmations')
    .select('match_result_id')
    .eq('user_id', userId)
    .in('match_result_id', resultIds)

  if (confError) throw new Error(confError.message)

  const responded = new Set((confs ?? []).map((c) => c.match_result_id))

  const out: AwaitingResultMatchRow[] = []
  for (const row of latestByMatch.values()) {
    const myTeam = teamByMatch.get(row.match_id)
    if (!myTeam || myTeam === row.submitted_by_team) continue
    if (responded.has(row.id)) continue
    const m = row.match
    if (!m) continue
    out.push({ ...m, match_result_id: row.id })
  }
  return out
}

/**
 * Data for the «Mis Partidas» tab: upcoming (planned, future), in progress,
 * and matches where the user must approve or dispute a submitted result.
 */
export async function getMyMatchesDashboard(userId: string): Promise<MyMatchesDashboard> {
  const [awaitingRes, participantRes] = await Promise.all([
    supabase.rpc('list_matches_awaiting_my_result_action'),
    supabase
      .from('match_participants')
      .select(`match:matches(id, title, start_at, city, status, visibility, creator_id)`)
      .eq('user_id', userId)
      .is('left_at', null)
      .eq('state', 'confirmed')
      .limit(120),
  ])

  let awaitingResultValidation: AwaitingResultMatchRow[]
  if (awaitingRes.error) {
    if (isMissingPostgrestRpcError(awaitingRes.error)) {
      awaitingResultValidation = await listAwaitingResultValidationClientFallback(userId)
    } else {
      throw new Error(awaitingRes.error.message)
    }
  } else {
    awaitingResultValidation = (awaitingRes.data ?? []) as AwaitingResultMatchRow[]
  }

  if (participantRes.error) throw new Error(participantRes.error.message)

  const now = Date.now()
  const fromParts = (participantRes.data ?? [])
    .map((r) => r.match as UserMatchSummary | null)
    .filter((m): m is UserMatchSummary => m !== null)

  const upcoming = fromParts
    .filter((m) => m.status === MATCH_STATUS.PLANNED && new Date(m.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  const inProgress = fromParts
    .filter((m) => m.status === MATCH_STATUS.IN_PROGRESS)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  awaitingResultValidation.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )

  return { upcoming, inProgress, awaitingResultValidation }
}

// ─── Public explore (F5) — RPC list_public_matches ───────────────────────────

export type PublicMatchExplorerRow = MatchRow & {
  slots_filled: number
  free_slots: number
}

type ListPublicMatchesRpc = Database['public']['Functions']['list_public_matches']

export type PublicMatchesListFilters = {
  search: string
  city: string
  /** `null` = any status */
  status: string | null
  startAfter: string | null
  startBefore: string | null
  /** 0 = no filter; otherwise require at least N free slots (of 4). */
  minFreeSlots: number
}

function emptyToUndefined(s: string | null | undefined): string | undefined {
  if (s == null) return undefined
  const t = s.trim()
  return t === '' ? undefined : t
}

/** Creator-only matches with no other registered players: record score and close match. */
export async function recordMatchResultDirect(
  matchId: string,
  teamAGames: number,
  teamBGames: number
): Promise<void> {
  const { error } = await supabase.rpc('record_match_result_direct', {
    p_match_id: matchId,
    p_team_a_games: teamAGames,
    p_team_b_games: teamBGames,
  })

  if (error) throw new Error(error.message)
}

/**
 * Paginated public matches for the explore screen (visibility = public only).
 * Requires DB migration `009_list_public_matches`.
 */
export async function listPublicMatchesPage(
  filters: PublicMatchesListFilters & { limit?: number; offset?: number }
): Promise<{ rows: PublicMatchExplorerRow[]; total: number; offset: number }> {
  const limit = filters.limit ?? MATCH_PAGE_SIZE
  const offset = filters.offset ?? 0

  const args: ListPublicMatchesRpc['Args'] = {
    p_search: emptyToUndefined(filters.search),
    p_city: emptyToUndefined(filters.city),
    p_status: filters.status && filters.status.trim() !== '' ? filters.status.trim() : undefined,
    p_start_after: filters.startAfter ?? undefined,
    p_start_before: filters.startBefore ?? undefined,
    p_min_free_slots:
      filters.minFreeSlots > 0 && filters.minFreeSlots <= 4 ? filters.minFreeSlots : undefined,
    p_limit: limit,
    p_offset: offset,
  }

  const { data, error } = await supabase.rpc('list_public_matches', args)

  if (error) throw new Error(error.message)

  const raw = (data ?? []) as ListPublicMatchesRpc['Returns']
  if (raw.length === 0) {
    return { rows: [], total: 0, offset }
  }

  const total = Number(raw[0].total_count)
  const rows: PublicMatchExplorerRow[] = raw.map((r) => {
    const { total_count: _totalCount, ...rest } = r
    void _totalCount
    return rest as PublicMatchExplorerRow
  })

  return { rows, total, offset }
}
