import { expectedMatchCount, generateRoundRobinFixtures } from '@/utils/leagueFixtures'

describe('generateRoundRobinFixtures', () => {
  it('generates correct count for 4 pairs single round', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, false)
    expect(fixtures).toHaveLength(expectedMatchCount(4, false))
    expect(fixtures.every((f) => !f.isSecondLeg)).toBe(true)
  })

  it('doubles fixtures for double round', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, true)
    expect(fixtures).toHaveLength(expectedMatchCount(4, true))
    expect(fixtures.filter((f) => f.isSecondLeg)).toHaveLength(expectedMatchCount(4, false))
  })

  it('handles odd number of pairs with byes', () => {
    const ids = ['a', 'b', 'c']
    const fixtures = generateRoundRobinFixtures(ids, false)
    expect(fixtures).toHaveLength(expectedMatchCount(3, false))
    for (const id of ids) {
      const count = fixtures.filter((f) => f.pairAId === id || f.pairBId === id).length
      expect(count).toBe(2)
    }
  })

  it('returns empty for fewer than 2 pairs', () => {
    expect(generateRoundRobinFixtures(['a'], false)).toEqual([])
  })
})
