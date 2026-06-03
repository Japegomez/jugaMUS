import { parseIsoToDate } from '@/components/ui/dateTimePickerUtils'

export type MatchRosterTextFields = {
  team_a_player_2?: string
  team_b_player_1?: string
  team_b_player_2?: string
}

export const PAST_DATE_INCOMPLETE_ROSTER_ALERT = {
  title: 'Fecha no válida',
  message:
    'Al faltar jugadores, la partida debe programarse en una fecha y hora futuras. Actualiza la fecha para poder crearla o añade jugadores.',
} as const

/** Past relative to submit time; same minute as "now" counts as current (picker uses minute precision). */
export function isMatchStartAtPast(iso: string, now: Date = new Date()): boolean {
  const start = parseIsoToDate(iso)
  const startMinute = Math.floor(start.getTime() / 60_000)
  const nowMinute = Math.floor(now.getTime() / 60_000)
  return startMinute < nowMinute
}

/** True when any of the three optional text slots (besides creator) is empty. */
export function hasIncompleteMatchRoster(fields: MatchRosterTextFields): boolean {
  const filled = (value?: string) => Boolean(value?.trim())
  return (
    !filled(fields.team_a_player_2) ||
    !filled(fields.team_b_player_1) ||
    !filled(fields.team_b_player_2)
  )
}

export function requiresFutureStartAtForIncompleteRoster(
  startAt: string,
  roster: MatchRosterTextFields
): boolean {
  return isMatchStartAtPast(startAt) && hasIncompleteMatchRoster(roster)
}
