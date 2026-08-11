export type FixturePairing = {
  pairAId: string
  pairBId: string
  roundNumber: number
  isSecondLeg: boolean
}

/**
 * Circle-method round-robin fixtures.
 * Odd number of pairs → one bye per round (that pair sits out).
 */
export function generateRoundRobinFixtures(
  pairIds: string[],
  doubleRound: boolean
): FixturePairing[] {
  if (pairIds.length < 2) return []

  const ids: (string | null)[] = [...pairIds]
  if (ids.length % 2 === 1) ids.push(null)

  const n = ids.length
  const rounds = n - 1
  const half = n / 2
  const fixed = ids[0]
  let rot = ids.slice(1)
  const fixtures: FixturePairing[] = []

  for (let round = 1; round <= rounds; round++) {
    const home = fixed
    const away = rot[rot.length - 1]
    if (home && away) {
      if (round % 2 === 0) {
        fixtures.push({ pairAId: away, pairBId: home, roundNumber: round, isSecondLeg: false })
      } else {
        fixtures.push({ pairAId: home, pairBId: away, roundNumber: round, isSecondLeg: false })
      }
    }

    for (let i = 0; i < half - 1; i++) {
      const h = rot[i]
      // Evita emparejar de nuevo el elemento fijo que ya se usó contra `away`.
      const a = rot[rot.length - 2 - i]
      if (!h || !a) continue
      if ((round + i) % 2 === 0) {
        fixtures.push({ pairAId: a, pairBId: h, roundNumber: round, isSecondLeg: false })
      } else {
        fixtures.push({ pairAId: h, pairBId: a, roundNumber: round, isSecondLeg: false })
      }
    }

    const last = rot[rot.length - 1]
    rot = [last, ...rot.slice(0, -1)]
  }

  if (doubleRound) {
    const secondLeg = fixtures.map((f) => ({
      pairAId: f.pairBId,
      pairBId: f.pairAId,
      roundNumber: f.roundNumber + rounds,
      isSecondLeg: true,
    }))
    return [...fixtures, ...secondLeg]
  }

  return fixtures
}

/** Expected number of matches for N complete pairs. */
export function expectedMatchCount(pairCount: number, doubleRound: boolean): number {
  if (pairCount < 2) return 0
  const single = (pairCount * (pairCount - 1)) / 2
  return doubleRound ? single * 2 : single
}
