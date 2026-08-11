import { idsFromRealtimeRow } from '@/lib/realtimeRowIds'

describe('realtimeRowIds', () => {
  it('maps matches row ids', () => {
    expect(idsFromRealtimeRow('matches', { id: 'm1', tournament_id: 't1' })).toEqual({
      matchId: 'm1',
      tournamentId: 't1',
    })
  })

  it('maps match_results row', () => {
    expect(idsFromRealtimeRow('match_results', { match_id: 'm2' })).toEqual({
      matchId: 'm2',
    })
  })

  it('returns empty object for missing record', () => {
    expect(idsFromRealtimeRow('tournaments', undefined)).toEqual({})
  })

  it('ignores non-string ids', () => {
    expect(idsFromRealtimeRow('matches', { id: 123 })).toEqual({})
  })
})
