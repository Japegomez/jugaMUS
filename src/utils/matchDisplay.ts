import { BRACKET_ROUND_LABELS, MATCH_STATUS } from '@/constants'

export type MatchOutcome = 'won' | 'lost' | null

/** Tournament match title with proper round name (Cuartos, Semifinal, …). */
export function displayMatchTitle(match: {
  title: string
  tournament_round_size?: number | null
}): string {
  if (match.tournament_round_size == null) return match.title

  const round =
    BRACKET_ROUND_LABELS[match.tournament_round_size] ?? `Ronda ${match.tournament_round_size}`
  const tournamentName = match.title.split(' — ')[0]?.trim() || match.title
  const isBye = match.title.includes('(bye)')

  return `${tournamentName} — ${round}${isBye ? ' (bye)' : ''}`
}

export function resolveMatchOutcome(match: {
  status: string
  user_team?: 'A' | 'B' | null
  team_a_games?: number | null
  team_b_games?: number | null
}): MatchOutcome {
  if (match.status !== MATCH_STATUS.FINISHED) return null
  if (!match.user_team || match.team_a_games == null || match.team_b_games == null) return null
  if (match.team_a_games === match.team_b_games) return null

  const userWon =
    match.user_team === 'A'
      ? match.team_a_games > match.team_b_games
      : match.team_b_games > match.team_a_games

  return userWon ? 'won' : 'lost'
}

export function matchHistoryBackground(outcome: MatchOutcome): string | undefined {
  if (outcome === 'won') return '#e8f5ef'
  if (outcome === 'lost') return '#fdeaea'
  return undefined
}
