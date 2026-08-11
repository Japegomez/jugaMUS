import { LEAGUE_STATUS, MATCH_STATUS, TOURNAMENT_STATUS } from '@/constants'
import { filterExploreItemsForCelebrated, type ExploreItem } from '@/utils/exploreFilters'

function matchItem(status: string): ExploreItem {
  return {
    kind: 'match',
    id: 'm1',
    start_at: '2026-01-01T00:00:00Z',
    row: { status } as ExploreItem extends { kind: 'match'; row: infer R } ? R : never,
  }
}

function tournamentItem(status: string): ExploreItem {
  return {
    kind: 'tournament',
    id: 't1',
    start_at: '2026-01-01T00:00:00Z',
    row: { status } as ExploreItem extends { kind: 'tournament'; row: infer R } ? R : never,
  }
}

function leagueItem(status: string): ExploreItem {
  return {
    kind: 'league',
    id: 'l1',
    start_at: '2026-01-01T00:00:00Z',
    row: { status } as ExploreItem extends { kind: 'league'; row: infer R } ? R : never,
  }
}

describe('filterExploreItemsForCelebrated', () => {
  const mixed: ExploreItem[] = [
    matchItem(MATCH_STATUS.PLANNED),
    matchItem(MATCH_STATUS.FINISHED),
    matchItem(MATCH_STATUS.FINISHED_NO_RESULT),
    tournamentItem(TOURNAMENT_STATUS.REGISTRATION),
    tournamentItem(TOURNAMENT_STATUS.FINISHED),
    leagueItem(LEAGUE_STATUS.IN_PROGRESS),
    leagueItem(LEAGUE_STATUS.FINISHED),
  ]

  it('returns all items when hideCelebrated is false', () => {
    expect(filterExploreItemsForCelebrated(mixed, false)).toHaveLength(mixed.length)
  })

  it('hides finished matches, tournaments and leagues', () => {
    const filtered = filterExploreItemsForCelebrated(mixed, true)
    expect(filtered).toHaveLength(3)
    expect(filtered.map((i) => i.kind)).toEqual(['match', 'tournament', 'league'])
  })
})
