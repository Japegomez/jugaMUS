import { DEFAULT_TEAM_A_NAME, DEFAULT_TEAM_B_NAME, TEAM } from '@/constants'

type TextPlayerFields = {
  team_a_player_1: string | null
  team_a_player_2: string | null
  team_b_player_1: string | null
  team_b_player_2: string | null
}

export type TeamRosterParticipant = {
  team: string
  joined_at: string
  left_at: string | null
  profile: { display_name: string }
}

export type ResolveTeamNameMatch = TextPlayerFields & {
  team_a_name: string
  team_b_name: string
}

function activeParticipants<T extends TeamRosterParticipant>(
  participants: Array<T | null | undefined>
) {
  return participants.filter((p): p is T => Boolean(p && p.left_at === null))
}

export function isUnspecifiedTeamName(name: string | null | undefined, team: string): boolean {
  const trimmed = name?.trim()
  if (!trimmed) return true
  return trimmed === (team === TEAM.B ? DEFAULT_TEAM_B_NAME : DEFAULT_TEAM_A_NAME)
}

function participantDisplayName(p: TeamRosterParticipant | null | undefined): string | null {
  const name = p?.profile?.display_name?.trim()
  return name || null
}

function registeredOnTeam<T extends TeamRosterParticipant>(
  participants: Array<T | null | undefined>,
  team: string
): T[] {
  return activeParticipants(participants)
    .filter((p) => p.team === team)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at)) as T[]
}

export type TeamRosterEntry<T extends TeamRosterParticipant = TeamRosterParticipant> =
  | { kind: 'registered'; participant: T }
  | { kind: 'text'; name: string }

function collectTeamRosterEntriesFromSlots<T extends TeamRosterParticipant>(
  textSlot1: string | null | undefined,
  textSlot2: string | null | undefined,
  participants: T[],
  team: string
): TeamRosterEntry<T>[] {
  const registered = registeredOnTeam(participants, team)
  const entries: TeamRosterEntry<T>[] = []
  const text1 = textSlot1?.trim() || null
  const text2 = textSlot2?.trim() || null
  let regIdx = 0

  if (text1) {
    entries.push({ kind: 'text', name: text1 })
  } else if (registered[regIdx]) {
    entries.push({ kind: 'registered', participant: registered[regIdx++] })
  }

  const firstName =
    entries[0]?.kind === 'text'
      ? entries[0].name
      : entries[0]?.kind === 'registered'
        ? participantDisplayName(entries[0].participant)
        : null

  if (text2 && text2 !== firstName) {
    entries.push({ kind: 'text', name: text2 })
  } else if (registered[regIdx]) {
    entries.push({ kind: 'registered', participant: registered[regIdx++] })
  }

  return entries.slice(0, 2)
}

/** Roster slots in display order (matches default team name ordering). */
export function collectTeamRosterEntries<T extends TeamRosterParticipant>(
  match: TextPlayerFields,
  participants: T[],
  team: string
): TeamRosterEntry<T>[] {
  if (team === TEAM.A) {
    return collectTeamRosterEntriesFromSlots(
      match.team_a_player_1,
      match.team_a_player_2,
      participants,
      team
    )
  }

  return collectTeamRosterEntriesFromSlots(
    match.team_b_player_1,
    match.team_b_player_2,
    participants,
    team
  )
}

export function collectTeamPlayerNames(
  match: TextPlayerFields,
  participants: TeamRosterParticipant[],
  team: string
): string[] {
  return collectTeamRosterEntries(match, participants, team).map((entry) =>
    entry.kind === 'registered' ? participantDisplayName(entry.participant)! : entry.name
  )
}

export function formatTeamNameFromPlayers(names: string[]): string | null {
  if (names.length >= 2) return `${names[0]} - ${names[1]}`
  if (names.length === 1) return names[0]
  return null
}

export function resolveTeamName(
  match: ResolveTeamNameMatch,
  team: string,
  participants: TeamRosterParticipant[] = []
): string {
  const stored = team === TEAM.B ? match.team_b_name : match.team_a_name
  if (!isUnspecifiedTeamName(stored, team)) {
    return stored.trim()
  }

  const derived = formatTeamNameFromPlayers(collectTeamPlayerNames(match, participants, team))
  if (derived) return derived

  return team === TEAM.B ? DEFAULT_TEAM_B_NAME : DEFAULT_TEAM_A_NAME
}
