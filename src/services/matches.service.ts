import { supabase } from '@/lib/supabase'
import { MATCH_STATUS, MAX_PLAYERS_PER_TEAM, MATCH_PAGE_SIZE } from '@/constants'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'

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
    .insert({ ...data, creator_id: userId })
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
  const { data: row, error } = await supabase
    .from('matches')
    .update(data)
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
