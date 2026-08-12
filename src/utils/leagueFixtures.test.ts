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

  it('covers every unordered pair once in a single round', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, false)
    const pairs = fixtures.map((f) => [f.pairAId, f.pairBId].sort().join('|'))
    expect(new Set(pairs).size).toBe(pairs.length)
    const expected = new Set<string>()
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expected.add([ids[i], ids[j]].sort().join('|'))
      }
    }
    expect(new Set(pairs)).toEqual(expected)
  })

  it('second leg inverts first-leg pairings', () => {
    const ids = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobinFixtures(ids, true)
    const first = fixtures.filter((f) => !f.isSecondLeg)
    const second = fixtures.filter((f) => f.isSecondLeg)
    expect(second).toHaveLength(first.length)
    for (const leg of second) {
      const mirror = first.find((f) => f.pairAId === leg.pairBId && f.pairBId === leg.pairAId)
      expect(mirror).toBeDefined()
    }
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
