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

export const TEAM = {
  A: 'A',
  B: 'B',
} as const

export const MAX_PLAYERS_PER_TEAM = 2
export const MATCH_PAGE_SIZE = 20
export const QUERY_STALE_TIME = 5 * 60 * 1000 // 5 minutos
