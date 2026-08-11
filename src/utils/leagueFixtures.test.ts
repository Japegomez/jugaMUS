import { expectedMatchCount, generateRoundRobinFixtures } from '@/utils/leagueFixtures'

function unorderedPairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function expectUniqueDistinctPairings(
  pairIds: string[],
  fixtures: ReturnType<typeof generateRoundRobinFixtures>
) {
  const keys = fixtures.map((f) => unorderedPairKey(f.pairAId, f.pairBId))
  expect(new Set(keys).size).toBe(keys.length)
  for (const fixture of fixtures) {
    expect(fixture.pairAId).not.toBe(fixture.pairBId)
  }
  const expectedPairs = (pairIds.length * (pairIds.length - 1)) / 2
  // single-round unique pairings (ignore second-leg duplicates by filtering)
  const firstLeg = fixtures.filter((f) => !f.isSecondLeg)
  expect(new Set(firstLeg.map((f) => unorderedPairKey(f.pairAId, f.pairBId))).size).toBe(
    expectedPairs
  )
}

describe('generateRoundRobinFixtures', () => {
  it('generates correct count for 4 pairs single round', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, false)
    expect(fixtures).toHaveLength(expectedMatchCount(4, false))
    expect(fixtures.every((f) => !f.isSecondLeg)).toBe(true)
    expectUniqueDistinctPairings(ids, fixtures)
  })

  it('doubles fixtures for double round', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, true)
    expect(fixtures).toHaveLength(expectedMatchCount(4, true))
    expect(fixtures.filter((f) => f.isSecondLeg)).toHaveLength(expectedMatchCount(4, false))
    expectUniqueDistinctPairings(
      ids,
      fixtures.filter((f) => !f.isSecondLeg)
    )
  })

  it('handles odd number of pairs with byes', () => {
    const ids = ['a', 'b', 'c']
    const fixtures = generateRoundRobinFixtures(ids, false)
    expect(fixtures).toHaveLength(expectedMatchCount(3, false))
    for (const id of ids) {
      const count = fixtures.filter((f) => f.pairAId === id || f.pairBId === id).length
      expect(count).toBe(2)
    }
    expectUniqueDistinctPairings(ids, fixtures)
  })

  it('returns empty for fewer than 2 pairs', () => {
    expect(generateRoundRobinFixtures(['a'], false)).toEqual([])
  })
})
