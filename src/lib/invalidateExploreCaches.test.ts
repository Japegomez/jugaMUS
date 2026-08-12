import { idsFromRealtimeRow } from '@/lib/realtimeRowIds'

describe('idsFromRealtimeRow', () => {
  it('maps matches row', () => {
    expect(idsFromRealtimeRow('matches', { id: 'm1', tournament_id: 't1' })).toEqual({
      matchId: 'm1',
      tournamentId: 't1',
    })
  })

  it('maps match_participants row', () => {
    expect(idsFromRealtimeRow('match_participants', { match_id: 'm2' })).toEqual({
      matchId: 'm2',
    })
  })

  it('maps tournaments row', () => {
    expect(idsFromRealtimeRow('tournaments', { id: 't3' })).toEqual({
      tournamentId: 't3',
    })
  })

  it('maps tournament_pairs row', () => {
    expect(idsFromRealtimeRow('tournament_pairs', { tournament_id: 't4' })).toEqual({
      tournamentId: 't4',
    })
  })

  it('maps match_invitations row', () => {
    expect(idsFromRealtimeRow('match_invitations', { match_id: 'm5' })).toEqual({
      matchId: 'm5',
    })
  })

  it('maps friendships row to empty ids', () => {
    expect(idsFromRealtimeRow('friendships', { id: 'f1' })).toEqual({})
  })
})
