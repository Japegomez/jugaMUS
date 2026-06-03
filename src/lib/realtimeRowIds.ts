export type RealtimeListTable =
  | 'matches'
  | 'match_participants'
  | 'match_results'
  | 'tournaments'
  | 'tournament_pairs'

/** Map a changed row to match/tournament detail query keys. */
export function idsFromRealtimeRow(
  table: RealtimeListTable,
  record: Record<string, unknown> | undefined
): { matchId?: string; tournamentId?: string } {
  if (!record) return {}

  switch (table) {
    case 'matches': {
      const matchId = typeof record.id === 'string' ? record.id : undefined
      const tournamentId =
        typeof record.tournament_id === 'string' ? record.tournament_id : undefined
      return { matchId, tournamentId }
    }
    case 'match_participants':
    case 'match_results':
      return {
        matchId: typeof record.match_id === 'string' ? record.match_id : undefined,
      }
    case 'tournaments':
      return {
        tournamentId: typeof record.id === 'string' ? record.id : undefined,
      }
    case 'tournament_pairs':
      return {
        tournamentId: typeof record.tournament_id === 'string' ? record.tournament_id : undefined,
      }
    default:
      return {}
  }
}
