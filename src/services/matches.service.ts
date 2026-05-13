import { supabase } from '@/lib/supabase'
import { MATCH_STATUS, MAX_PLAYERS_PER_TEAM, MATCH_PAGE_SIZE } from '@/constants'
import type { Database, TablesInsert, TablesUpdate } from '@/types/database.types'

/** `timestamptz` must receive an explicit instant; bare local strings are parsed as UTC on Supabase. */
function startAtToTimestamptzIso(startAt: string): string {
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Fecha de inicio no válida')
  }
  return d.toISOString()
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

// ─── Match CRUD ───────────────────────────────────────────────────────────────

export async function createMatch(userId: string, data: MatchInsert): Promise<MatchRow> {
  const { data: row, error } = await supabase
    .from('matches')
    .insert({ ...data, start_at: startAtToTimestamptzIso(data.start_at), creator_id: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row as MatchRow
}

/**
 * Fetch a single match together with all its participants and their basic
 * profile info (display_name, photo_url, city).
 * Phone numbers are NOT included here — use getParticipantProfile() for that.
 */
export async function getMatch(id: string): Promise<MatchWithParticipants> {
  const { data, error } = await supabase
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

  if (error) throw new Error(error.message)

  const raw = data as MatchRow & {
    participants: Array<ParticipantRow & { profile: ParticipantProfile | null }>
  }

  return {
    ...raw,
    participants: (raw.participants ?? []).map((p) => ({
      ...p,
      profile: p.profile ?? {
        id: p.user_id,
        display_name: 'Usuario',
        photo_url: null,
        city: null,
        phone_e164: null,
      },
    })),
  }
}

export async function updateMatch(id: string, data: MatchUpdate): Promise<MatchRow> {
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
    .update({ status: MATCH_STATUS.FINISHED })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return row as MatchRow
}

// ─── Participants ─────────────────────────────────────────────────────────────

/**
 * Join a match for a given team.
 * The DB constraint ensures max MAX_PLAYERS_PER_TEAM per team.
 * We surface a friendly error if the limit is reached.
 */
export async function joinMatch(
  matchId: string,
  userId: string,
  team: string
): Promise<ParticipantRow> {
  const { data, error } = await supabase
    .from('match_participants')
    .insert({ match_id: matchId, user_id: userId, team })
    .select()
    .single()

  if (error) {
    if (error.message.includes('max_players') || error.code === '23514' || error.code === '23505') {
      throw new Error(`El equipo ${team} ya tiene ${MAX_PLAYERS_PER_TEAM} jugadores.`)
    }
    throw new Error(error.message)
  }

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
