import {
  clearPendingMatchResultFromScoreboard,
  getPendingMatchResultFromScoreboard,
  setPendingMatchResultFromScoreboard,
} from '@/lib/pendingMatchResultFromScoreboard'

describe('pendingMatchResultFromScoreboard', () => {
  beforeEach(() => {
    clearPendingMatchResultFromScoreboard()
  })

  it('stores and reads pending result for matching match id', () => {
    setPendingMatchResultFromScoreboard({
      matchId: 'm1',
      teamAGames: 2,
      teamBGames: 1,
    })

    expect(getPendingMatchResultFromScoreboard('m1')).toEqual({
      matchId: 'm1',
      teamAGames: 2,
      teamBGames: 1,
    })
  })

  it('returns null for other match ids without clearing', () => {
    setPendingMatchResultFromScoreboard({
      matchId: 'm1',
      teamAGames: 1,
      teamBGames: 0,
    })

    expect(getPendingMatchResultFromScoreboard('m2')).toBeNull()
    expect(getPendingMatchResultFromScoreboard('m1')).not.toBeNull()
  })

  it('clears pending result', () => {
    setPendingMatchResultFromScoreboard({
      matchId: 'm1',
      teamAGames: 3,
      teamBGames: 2,
    })

    clearPendingMatchResultFromScoreboard('m1')
    expect(getPendingMatchResultFromScoreboard('m1')).toBeNull()
  })
})
