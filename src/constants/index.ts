export const MATCH_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  FINISHED_NO_RESULT: 'finished_no_result',
  CANCELLED: 'cancelled',
} as const

/** `match_results.status` — DB check constraint (migration 010). */
export const RESULT_STATUS = {
  PENDING_VALIDATION: 'pending_validation',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed',
  VOID: 'void',
} as const

export const MATCH_VISIBILITY = {
  PUBLIC: 'public',
  LINK: 'link',
} as const

export const TOURNAMENT_STATUS = {
  REGISTRATION: 'registration',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
} as const

export type ExploreContentType = 'all' | 'matches' | 'tournaments'

export const BRACKET_ROUND_LABELS: Record<number, string> = {
  2: 'Final',
  4: 'Semifinal',
  8: 'Cuartos',
  16: 'Octavos',
  32: 'Dieciseisavos',
}

export const TEAM = {
  A: 'A',
  B: 'B',
} as const

export const DEFAULT_TEAM_A_NAME = 'Equipo A'
export const DEFAULT_TEAM_B_NAME = 'Equipo B'

export const MAX_PLAYERS_PER_TEAM = 2
export const MATCH_PAGE_SIZE = 20
export const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutos
/** Torneos: datos compartidos entre dispositivos — refresco más frecuente. */
export const TOURNAMENT_QUERY_STALE_TIME = 30 * 1000 // 30 segundos
export const TOURNAMENT_REFETCH_INTERVAL = 30 * 1000
