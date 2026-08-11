/** Standard Elo expected score for rating A vs B. */
export function eloExpected(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/**
 * Elo delta for player A after a match.
 * @param scoreA 1 = win, 0 = loss (draws not used in mus)
 */
export function eloDelta(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 1,
  kFactor: number
): number {
  const expected = eloExpected(ratingA, ratingB)
  return Math.round(kFactor * (scoreA - expected))
}

export type EloUpdate = {
  ratingABefore: number
  ratingBBefore: number
  deltaA: number
  deltaB: number
  ratingAAfter: number
  ratingBAfter: number
}

export function computeEloUpdate(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
  kFactor: number
): EloUpdate {
  const scoreA: 0 | 1 = aWon ? 1 : 0
  const deltaA = eloDelta(ratingA, ratingB, scoreA, kFactor)
  const deltaB = eloDelta(ratingB, ratingA, aWon ? 0 : 1, kFactor)
  return {
    ratingABefore: ratingA,
    ratingBBefore: ratingB,
    deltaA,
    deltaB,
    ratingAAfter: ratingA + deltaA,
    ratingBAfter: ratingB + deltaB,
  }
}
