import { computeEloUpdate, eloDelta, eloExpected } from '@/utils/elo'

describe('elo', () => {
  it('expected score is 0.5 for equal ratings', () => {
    expect(eloExpected(1000, 1000)).toBeCloseTo(0.5)
  })

  it('favorite has expected > 0.5', () => {
    expect(eloExpected(1200, 1000)).toBeGreaterThan(0.5)
  })

  it('upset win gives larger delta than expected win', () => {
    const upset = eloDelta(1000, 1200, 1, 32)
    const expectedWin = eloDelta(1200, 1000, 1, 32)
    expect(upset).toBeGreaterThan(expectedWin)
  })

  it('computeEloUpdate keeps zero-sum deltas approximately', () => {
    const update = computeEloUpdate(1000, 1000, true, 32)
    expect(update.deltaA).toBe(16)
    expect(update.deltaB).toBe(-16)
    expect(update.ratingAAfter).toBe(1016)
    expect(update.ratingBAfter).toBe(984)
  })
})
