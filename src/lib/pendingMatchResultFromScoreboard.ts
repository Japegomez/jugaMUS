/** Intent in-memory: abrir registrar resultado tras el marcador (sobrevive remounts por orientación). */

export type PendingMatchResultFromScoreboard = {
  matchId: string
  teamAGames: number
  teamBGames: number
}

let pending: PendingMatchResultFromScoreboard | null = null

export function setPendingMatchResultFromScoreboard(
  result: PendingMatchResultFromScoreboard
): void {
  pending = result
}

/** Lee el intent sin borrarlo (el remount por orientación puede ocurrir antes de abrir el modal). */
export function getPendingMatchResultFromScoreboard(
  matchId: string
): PendingMatchResultFromScoreboard | null {
  if (!pending || pending.matchId !== matchId) return null
  return pending
}

export function clearPendingMatchResultFromScoreboard(matchId?: string): void {
  if (!matchId || pending?.matchId === matchId) pending = null
}
