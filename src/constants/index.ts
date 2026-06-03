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

/** Tab root screens: one refetch when stale (avoid refetchOnMount:'always' + focus double-fetch). */
export const TAB_SCREEN_QUERY_OPTIONS = {
  staleTime: TOURNAMENT_QUERY_STALE_TIME,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const

export const MUS_PHASES = ['grande', 'pequena', 'pares', 'juego'] as const
export type MusPhase = (typeof MUS_PHASES)[number]

export const MUS_DEFAULT_BET = 2
export const MUS_POINTS_PER_GAME = 40
export const MUS_POINTS_SLIDER_MAX = 40

export const MUS_PHASE_LABELS: Record<MusPhase, string> = {
  grande: 'Grande',
  pequena: 'Pequeña',
  pares: 'Pares',
  juego: 'Juego',
}
