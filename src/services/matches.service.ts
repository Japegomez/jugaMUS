import { mapResultRpcError } from '@/services/results.service'
import { trackMatchCompletedOnce, trackMatchCreated, trackMatchJoined } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { resolveTeamName, type ResolveTeamNameMatch } from '@/utils/matchTeamNames'
import {
  MATCH_STATUS,
  MATCH_VISIBILITY,
  MAX_PLAYERS_PER_TEAM,
  MATCH_PAGE_SIZE,
  RESULT_STATUS,
  TEAM,
  type ExploreContentType,
} from '@/constants'
import type { Database, TablesInsert, TablesUpdate } from '@/types/database.types'
import { resolveMatchOutcome, type MatchOutcome } from '@/utils/matchDisplay'

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
  password_hash: string | null
  status: string
  creator_id: string
  team_a_name: string
  team_a_player_1: string | null
  team_a_player_2: string | null
  team_b_name: string
  team_b_player_1: string | null
  team_b_player_2: string | null
  tournament_id: string | null
  tournament_round_size: number | null
  tournament_bracket_position: number | null
  tournament_pair_a_id: string | null
  tournament_pair_b_id: string | null
  tournament_winner_pair_id: string | null
  tournament_is_bye: boolean
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
  viewer_has_full_access?: boolean
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

export type { TextPlayerFields }

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

export function isRosterFull(
  match: TextPlayerFields,
  participants: ParticipantWithProfile[]
): boolean {
  return (
    freeTeamSlots(match, participants, TEAM.A) === 0 &&
    freeTeamSlots(match, participants, TEAM.B) === 0
  )
}

function participantRowToWithProfile(row: ParticipantRow): ParticipantWithProfile {
  return {
    ...row,
    profile: {
      id: row.user_id,
      display_name: 'Usuario',
      photo_url: null,
      city: null,
      phone_e164: null,
    },
  }
}

/** Standalone match: start immediately when start_at has passed and roster is full (4 slots). */
async function promoteToInProgressIfReady(
  match: MatchRow,
  participants: ParticipantWithProfile[]
): Promise<MatchRow> {
  if (match.tournament_id) return match
  if (match.status !== MATCH_STATUS.PLANNED) return match
  if (new Date(match.start_at).getTime() > Date.now()) return match
  if (!isRosterFull(match, participants)) return match

  const { data: updated, error } = await supabase
    .from('matches')
    .update({ status: MATCH_STATUS.IN_PROGRESS })
    .eq('id', match.id)
    .eq('status', MATCH_STATUS.PLANNED)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated as MatchRow
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
  matchForNames?: ResolveTeamNameMatch
): string | null {
  for (const team of [TEAM.A, TEAM.B]) {
    const registered = countTeamSlots(participants, team)
    const textCount = textPlayerNamesOnTeam(textFields, team).length
    if (registered + textCount > MAX_PLAYERS_PER_TEAM) {
      const label = matchForNames
        ? resolveTeamName(matchForNames, team, participants)
        : `equipo ${team}`
      return `${label} ya está completo; no puedes añadir más jugadores por nombre.`
    }
  }
  return null
}

export type MatchTeamEditSlot =
  | { kind: 'registered'; displayName: string }
  | { kind: 'text'; field: keyof TextPlayerFields; value: string }

function textFieldsForTeam(team: string): (keyof TextPlayerFields)[] {
  return team === TEAM.B
    ? ['team_b_player_1', 'team_b_player_2']
    : ['team_a_player_1', 'team_a_player_2']
}

/** Roster slots for the team edit modal (registered locked, text editable). */
export function buildMatchTeamEditSlots(
  match: TextPlayerFields,
  participants: ParticipantWithProfile[],
  team: string
): MatchTeamEditSlot[] {
  const [field1, field2] = textFieldsForTeam(team)
  const registered = activeParticipants(participants)
    .filter((p) => p.team === team)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))

  const text1 = match[field1]?.trim() || null
  const text2 = match[field2]?.trim() || null
  const slots: MatchTeamEditSlot[] = []
  let regIdx = 0

  if (text1) {
    slots.push({ kind: 'text', field: field1, value: text1 })
  } else if (registered[regIdx]) {
    slots.push({
      kind: 'registered',
      displayName: registered[regIdx].profile.display_name?.trim() || 'Jugador registrado',
    })
    regIdx++
  }

  const firstName =
    slots[0]?.kind === 'text'
      ? slots[0].value
      : slots[0]?.kind === 'registered'
        ? slots[0].displayName
        : null

  if (text2 && text2 !== firstName) {
    slots.push({ kind: 'text', field: field2, value: text2 })
  } else if (registered[regIdx]) {
    slots.push({
      kind: 'registered',
      displayName: registered[regIdx].profile.display_name?.trim() || 'Jugador registrado',
    })
  }

  return slots.slice(0, 2)
}

/** Active participant on a standalone planned match may edit their team roster. */
export function canEditMatchTeam(
  match: Pick<MatchRow, 'status' | 'tournament_id'>,
  participants: ParticipantWithProfile[],
  userId: string | undefined
): { canEdit: boolean; team: string | null } {
  if (!userId || match.tournament_id || match.status !== MATCH_STATUS.PLANNED) {
    return { canEdit: false, team: null }
  }

  const mine = activeParticipants(participants).find((p) => p.user_id === userId)
  if (!mine) return { canEdit: false, team: null }

  return { canEdit: true, team: mine.team }
}

function mapMatchTeamRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'Debes iniciar sesión'
  if (message.includes('match_not_found')) return 'Partida no encontrada'
  if (message.includes('tournament_match_not_editable')) {
    return 'Las partidas de torneo no se pueden editar desde aquí'
  }
  if (message.includes('match_not_planned')) {
    return 'Solo puedes editar la pareja mientras la partida está planificada'
  }
  if (message.includes('forbidden')) return 'No tienes permiso para editar este equipo'
  if (message.includes('invalid_text_field')) return 'Campo de jugador no válido'
  if (message.includes('roster_full')) return 'El equipo ya está completo'
  if (message.includes('cannot_clear_text_player')) {
    return 'No puedes quitar jugadores de la pareja; solo editar el nombre.'
  }
  return message
}

export type UpdateMatchTeamInput = {
  matchId: string
  teamName: string
  textUpdates: Partial<Record<keyof TextPlayerFields, string | null>>
}

export async function updateMatchTeam(input: UpdateMatchTeamInput): Promise<MatchRow> {
  const textUpdates: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(input.textUpdates)) {
    if (value === undefined) continue
    textUpdates[key] = value?.trim() ? value.trim() : null
  }

  const { data, error } = await supabase.rpc('update_match_team', {
    p_match_id: input.matchId,
    p_team_name: input.teamName?.trim() ?? '',
    p_text_updates: textUpdates,
  })

  if (error) throw new Error(mapMatchTeamRpcError(error.message))
  if (!data) throw new Error('No se pudo actualizar el equipo')
  return data as MatchRow
}

export type { ResolveTeamNameMatch } from '@/utils/matchTeamNames'
export {
  collectTeamPlayerNames,
  collectTeamRosterEntries,
  formatTeamNameFromPlayers,
  isUnspecifiedTeamName,
  resolveTeamName,
} from '@/utils/matchTeamNames'

const TEXT_PLAYER_UPDATE_KEYS = [
  'team_a_player_1',
  'team_a_player_2',
  'team_b_player_1',
  'team_b_player_2',
] as const satisfies ReadonlyArray<keyof TextPlayerFields>

// ─── Match CRUD ───────────────────────────────────────────────────────────────

export async function createMatch(
  userId: string,
  data: MatchInsert,
  password?: string
): Promise<MatchRow> {
  const startAt = startAtToTimestamptzIso(data.start_at)

  const { data: row, error } = await supabase
    .from('matches')
    .insert({ ...data, start_at: startAt, creator_id: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (data.visibility === MATCH_VISIBILITY.PRIVATE && password) {
    await setMatchPassword(row.id, password)
  }

  try {
    const participant = await joinMatch(row.id, userId, TEAM.A, { trackJoin: false })
    trackMatchCreated(row.id, data.visibility ?? MATCH_VISIBILITY.PUBLIC)
    return promoteToInProgressIfReady(row as MatchRow, [participantRowToWithProfile(participant)])
  } catch (joinErr) {
    throw joinErr instanceof Error
      ? joinErr
      : new Error('No se pudo añadirte como jugador del equipo A')
  }
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

  const matchRow = raw as MatchRow

  let viewerHasFullAccess = matchRow.visibility !== MATCH_VISIBILITY.PRIVATE
  if (matchRow.visibility === MATCH_VISIBILITY.PRIVATE) {
    const { data: canAccess, error: accessError } = await supabase.rpc('viewer_can_access_match', {
      p_match_id: id,
    })
    if (accessError) throw new Error(accessError.message)
    viewerHasFullAccess = Boolean(canAccess)
  }

  if (!viewerHasFullAccess) {
    return {
      ...matchRow,
      participants: [],
      viewer_has_full_access: false,
    }
  }

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
    } else {
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
    }
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

  return {
    ...matchRow,
    participants,
    viewer_has_full_access: true,
  }
}

export async function updateMatch(
  id: string,
  data: MatchUpdate,
  password?: string
): Promise<MatchRow> {
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

  if (data.visibility === MATCH_VISIBILITY.PRIVATE && password?.trim()) {
    await setMatchPassword(id, password.trim())
  }

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

/** Creator starts a planned match now: sets `start_at` to the current instant and status to `in_progress`. */
export async function startMatch(id: string): Promise<MatchRow> {
  const match = await getMatch(id)
  if (match.status !== MATCH_STATUS.PLANNED) {
    throw new Error(
      'La partida ya no está planificada. Puede que ya haya empezado o se haya cancelado.'
    )
  }
  if (!isRosterFull(match, match.participants)) {
    throw new Error(
      'Faltan jugadores. Completa la plantilla (invitar amigos o añadir nombres) antes de empezar.'
    )
  }

  const nowIso = new Date().toISOString()
  const { data: row, error } = await supabase
    .from('matches')
    .update({
      start_at: nowIso,
      status: MATCH_STATUS.IN_PROGRESS,
    })
    .eq('id', id)
    .eq('status', MATCH_STATUS.PLANNED)
    .select()
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) {
    throw new Error(
      'La partida ya no está planificada. Puede que ya haya empezado o se haya cancelado.'
    )
  }
  return row as MatchRow
}

/** Set or replace the bcrypt password of a private match (creator only). */
export async function setMatchPassword(matchId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('set_match_password', {
    p_match_id: matchId,
    p_password: password,
  })
  if (error) throw new Error(mapPrivateMatchRpcError(error.message))
}

/** Verify password and grant read access to a private match (does not join). */
export async function grantMatchPasswordAccess(matchId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('grant_match_password_access', {
    p_match_id: matchId,
    p_password: password,
  })
  if (error) throw new Error(mapPrivateMatchRpcError(error.message))
}

function mapPrivateMatchRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'Debes iniciar sesión'
  if (message.includes('password_empty')) return 'La contraseña no puede estar vacía'
  if (message.includes('forbidden')) return 'No tienes permiso para modificar esta partida'
  if (message.includes('match_not_found')) return 'Partida no encontrada'
  if (message.includes('not_private_match')) return 'Esta partida no es privada'
  if (message.includes('match_not_joinable')) return 'La partida ya no está disponible'
  if (message.includes('tournament_match')) {
    return 'Esta partida pertenece a un torneo. Accede desde la ficha del torneo.'
  }
  if (message.includes('match_no_password')) return 'Esta partida no tiene contraseña configurada'
  if (message.includes('wrong_password')) return 'Contraseña incorrecta'
  if (message.includes('already_participant')) return 'Ya participas en esta partida'
  return message
}

/** Join a private match after verifying the password. */
export async function joinPrivateMatch(
  matchId: string,
  team: string,
  password: string
): Promise<ParticipantRow> {
  const { data, error } = await supabase.rpc('join_private_match', {
    p_match_id: matchId,
    p_team: team,
    p_password: password,
  })
  if (error) throw new Error(mapPrivateMatchRpcError(error.message))
  if (!data) throw new Error('No se pudo unir a la partida')
  return data as ParticipantRow
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
  team: string,
  options?: { trackJoin?: boolean }
): Promise<ParticipantRow> {
  const { data: matchMeta, error: matchError } = await supabase
    .from('matches')
    .select('tournament_id')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  if (matchMeta?.tournament_id) {
    throw new Error('Esta partida pertenece a un torneo. Accede desde la ficha del torneo.')
  }

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
    if (options?.trackJoin !== false) {
      trackMatchJoined(matchId, team)
    }
    return data as ParticipantRow
  }

  const { data, error } = await supabase
    .from('match_participants')
    .insert({ match_id: matchId, user_id: userId, team })
    .select()
    .single()

  if (error) throwJoinMatchError(error, team)
  if (options?.trackJoin !== false) {
    trackMatchJoined(matchId, team)
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
  place_defined: boolean
  place_text: string | null
  status: string
  visibility: string
  creator_id: string
  tournament_round_size?: number | null
  user_team?: 'A' | 'B' | null
  team_a_games?: number | null
  team_b_games?: number | null
  outcome?: MatchOutcome
}

/**
 * Fetch all matches where the user is the creator OR an active participant.
 * Returns a flat list of match summaries sorted by start_at descending.
 */
export async function getUserMatches(userId: string): Promise<UserMatchSummary[]> {
  const [asCreator, asParticipant] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, title, start_at, city, place_defined, place_text, status, visibility, creator_id'
      )
      .eq('creator_id', userId)
      .is('tournament_id', null)
      .eq('tournament_is_bye', false)
      .order('start_at', { ascending: false })
      .limit(MATCH_PAGE_SIZE),

    supabase
      .from('match_participants')
      .select(
        `match:matches!inner(id, title, start_at, city, place_defined, place_text, status, visibility, creator_id, tournament_round_size)`
      )
      .eq('user_id', userId)
      .is('left_at', null)
      .eq('match.tournament_is_bye', false)
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

  const byId = new Map<string, UserMatchSummary>()
  for (const m of [...creatorRows, ...participantRows]) {
    byId.set(m.id, m)
  }

  const matchIds = Array.from(byId.keys())
  if (matchIds.length === 0) return []

  const [teamsRes, resultsRes] = await Promise.all([
    supabase
      .from('match_participants')
      .select('match_id, team')
      .eq('user_id', userId)
      .in('match_id', matchIds)
      .is('left_at', null),
    supabase
      .from('match_results')
      .select('match_id, team_a_games, team_b_games, created_at')
      .in('match_id', matchIds)
      .eq('status', RESULT_STATUS.CONFIRMED)
      .order('created_at', { ascending: false }),
  ])

  if (teamsRes.error) throw new Error(teamsRes.error.message)
  if (resultsRes.error) throw new Error(resultsRes.error.message)

  const teamByMatch = new Map<string, 'A' | 'B'>()
  for (const row of teamsRes.data ?? []) {
    if (row.team === 'A' || row.team === 'B') {
      teamByMatch.set(row.match_id, row.team)
    }
  }

  const resultByMatch = new Map<string, { team_a_games: number; team_b_games: number }>()
  for (const row of resultsRes.data ?? []) {
    if (!resultByMatch.has(row.match_id)) {
      resultByMatch.set(row.match_id, {
        team_a_games: row.team_a_games,
        team_b_games: row.team_b_games,
      })
    }
  }

  return Array.from(byId.values())
    .map((m) => {
      const user_team = teamByMatch.get(m.id) ?? null
      const result = resultByMatch.get(m.id)
      const team_a_games = result?.team_a_games ?? null
      const team_b_games = result?.team_b_games ?? null
      const outcome = resolveMatchOutcome({
        status: m.status,
        user_team,
        team_a_games,
        team_b_games,
      })
      return { ...m, user_team, team_a_games, team_b_games, outcome }
    })
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
}

type ViewableUserMatchRow = {
  id: string
  title: string
  start_at: string
  city: string
  place_defined: boolean
  place_text: string | null
  status: string
  visibility: string
  creator_id: string
  user_team: string | null
  team_a_games: number | null
  team_b_games: number | null
}

/** Match history for another user, limited to matches the viewer can read. */
export async function getViewableUserMatches(userId: string): Promise<UserMatchSummary[]> {
  const { data, error } = await supabase.rpc('list_user_viewable_matches', {
    p_user_id: userId,
  })

  if (error) throw new Error(error.message)

  return ((data ?? []) as ViewableUserMatchRow[]).map((row) => {
    const user_team = row.user_team === 'A' || row.user_team === 'B' ? row.user_team : null
    const team_a_games = row.team_a_games ?? null
    const team_b_games = row.team_b_games ?? null
    const outcome = resolveMatchOutcome({
      status: row.status,
      user_team,
      team_a_games,
      team_b_games,
    })
    return {
      id: row.id,
      title: row.title,
      start_at: row.start_at,
      city: row.city,
      place_defined: row.place_defined,
      place_text: row.place_text,
      status: row.status,
      visibility: row.visibility,
      creator_id: row.creator_id,
      user_team,
      team_a_games,
      team_b_games,
      outcome,
    }
  })
}

const USER_MATCH_SUMMARY_SELECT =
  'id, title, start_at, city, place_defined, place_text, status, visibility, creator_id'

function mergeMatchSummaryInto(byId: Map<string, UserMatchSummary>, row: UserMatchSummary): void {
  const existing = byId.get(row.id)
  if (!existing) {
    byId.set(row.id, row)
    return
  }
  if (!existing.place_text?.trim() && row.place_text?.trim()) {
    byId.set(row.id, {
      ...existing,
      place_defined: row.place_defined,
      place_text: row.place_text,
    })
  }
}

/** Creator + confirmed participant matches (excludes bye bracket rows). */
async function listUserMatchSummariesForDashboard(userId: string): Promise<UserMatchSummary[]> {
  const [asCreator, asParticipant] = await Promise.all([
    supabase
      .from('matches')
      .select(USER_MATCH_SUMMARY_SELECT)
      .eq('creator_id', userId)
      .eq('tournament_is_bye', false)
      .limit(120),
    supabase
      .from('match_participants')
      .select(`match:matches!inner(${USER_MATCH_SUMMARY_SELECT})`)
      .eq('user_id', userId)
      .is('left_at', null)
      .eq('state', 'confirmed')
      .eq('match.tournament_is_bye', false)
      .limit(120),
  ])

  if (asCreator.error) throw new Error(asCreator.error.message)
  if (asParticipant.error) throw new Error(asParticipant.error.message)

  const byId = new Map<string, UserMatchSummary>()
  for (const row of (asCreator.data ?? []) as UserMatchSummary[]) {
    mergeMatchSummaryInto(byId, row)
  }
  for (const row of asParticipant.data ?? []) {
    const match = row.match as UserMatchSummary | null
    if (match) mergeMatchSummaryInto(byId, match)
  }

  return [...byId.values()]
}

/** Ensure venue fields come from `matches` (RPC/embed responses may omit them). */
async function attachPlaceFields<T extends UserMatchSummary>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows

  const ids = [...new Set(rows.map((row) => row.id))]
  const { data, error } = await supabase
    .from('matches')
    .select('id, place_defined, place_text')
    .in('id', ids)

  if (error) throw new Error(error.message)

  const placeById = new Map((data ?? []).map((row) => [row.id, row]))
  return rows.map((row) => {
    const place = placeById.get(row.id)
    if (!place) return row
    return {
      ...row,
      place_defined: place.place_defined,
      place_text: place.place_text,
    }
  })
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
       match:matches!inner(id, title, start_at, city, place_defined, place_text, status, visibility, creator_id, tournament_is_bye)`
    )
    .in('match_id', matchIds)
    .eq('status', RESULT_STATUS.PENDING_VALIDATION)
    .eq('match.tournament_is_bye', false)
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
  const [awaitingRes, matchSummaries] = await Promise.all([
    supabase.rpc('list_matches_awaiting_my_result_action'),
    listUserMatchSummariesForDashboard(userId),
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

  const [withPlaces, awaitingWithPlaces] = await Promise.all([
    attachPlaceFields(matchSummaries),
    attachPlaceFields(awaitingResultValidation),
  ])

  const now = Date.now()

  const upcoming = withPlaces
    .filter((m) => m.status === MATCH_STATUS.PLANNED && new Date(m.start_at).getTime() > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  const inProgress = withPlaces
    .filter((m) => m.status === MATCH_STATUS.IN_PROGRESS)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  awaitingWithPlaces.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  return {
    upcoming,
    inProgress,
    awaitingResultValidation: awaitingWithPlaces,
  }
}

// ─── Public explore (F5) — RPC list_public_matches ───────────────────────────

export type PublicMatchExplorerRow = MatchRow & {
  slots_filled: number
  free_slots: number
}

type ListPublicMatchesRpc = Database['public']['Functions']['list_public_matches']

export type { ExploreContentType } from '@/constants'

export type VisibilityFilter = 'all' | 'public' | 'private'

export type PublicMatchesListFilters = {
  search: string
  city: string
  /** `null` = any status */
  status: string | null
  /** When true, hides finished / finished_no_result and past-date explore rows. */
  hideCelebrated: boolean
  startAfter: string | null
  startBefore: string | null
  /** 0 = no filter; otherwise require at least N free slots (of 4). */
  minFreeSlots: number
  contentType: ExploreContentType
  /** 'all' = public + private (default), 'public' = only public, 'private' = only private. */
  visibility: VisibilityFilter
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

  if (error) throw new Error(mapResultRpcError(error.message))
  void trackMatchCompletedOnce(matchId).catch(() => {
    /* analytics must not block match close */
  })
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
    p_visibility:
      filters.visibility && filters.visibility !== 'all' ? filters.visibility : undefined,
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
