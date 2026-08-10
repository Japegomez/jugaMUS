import { computeLeagueStandings } from '@/utils/leagueStandings'

describe('computeLeagueStandings', () => {
  const pairs = [
    { id: 'a', name: 'Pareja A' },
    { id: 'b', name: 'Pareja B' },
    { id: 'c', name: 'Pareja C' },
  ]

  it('ranks by wins first', () => {
    const rows = computeLeagueStandings(pairs, [
      { pairAId: 'a', pairBId: 'b', teamAGames: 3, teamBGames: 1 },
      { pairAId: 'a', pairBId: 'c', teamAGames: 3, teamBGames: 0 },
      { pairAId: 'b', pairBId: 'c', teamAGames: 3, teamBGames: 2 },
    ])
    expect(rows.map((r) => r.pairId)).toEqual(['a', 'b', 'c'])
    expect(rows[0].wins).toBe(2)
  })

  it('uses games difference when h2h equal in a cycle', () => {
    const rows = computeLeagueStandings(pairs, [
      { pairAId: 'a', pairBId: 'b', teamAGames: 3, teamBGames: 1 },
      { pairAId: 'a', pairBId: 'c', teamAGames: 1, teamBGames: 3 },
      { pairAId: 'b', pairBId: 'c', teamAGames: 3, teamBGames: 0 },
    ])
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => r.wins))).toEqual(new Set([1]))
  })

  it('uses games difference when h2h equal among tied', () => {
    const two = [
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' },
      { id: 'z', name: 'Z' },
    ]
    const rows = computeLeagueStandings(two, [
      { pairAId: 'x', pairBId: 'y', teamAGames: 3, teamBGames: 2 },
      { pairAId: 'x', pairBId: 'z', teamAGames: 0, teamBGames: 3 },
      { pairAId: 'y', pairBId: 'z', teamAGames: 3, teamBGames: 0 },
    ])
    expect(rows[0].pairId).toBe('y')
  })
})
