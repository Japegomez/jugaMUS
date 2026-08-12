import { QueryClient } from '@tanstack/react-query'

import { collectPendingMatchIds } from '@/lib/realtimePending'
import { idsFromRealtimeRow } from '@/lib/realtimeRowIds'

import { invalidateAllExploreListQueries } from '@/lib/invalidateExploreCaches'

describe('invalidateAllExploreListQueries', () => {
  it('invalidates public explore and broad dashboard keys without userId', () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateAllExploreListQueries(queryClient)

    expect(spy).toHaveBeenCalledWith({ queryKey: ['my-matches-dashboard'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['user-matches'] })
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['viewable-user-matches'],
      exact: false,
    })
  })

  it('invalidates user-scoped and match/tournament detail keys when provided', () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateAllExploreListQueries(queryClient, {
      userId: 'u1',
      matchId: 'm1',
      tournamentId: 't1',
    })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['user-matches', 'u1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['match', 'm1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['match-insights', 'm1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1'] })
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

describe('collectPendingMatchIds', () => {
  it('keeps distinct match ids across consecutive invitation events', () => {
    const afterFirst = collectPendingMatchIds([], 'm-a')
    const afterSecond = collectPendingMatchIds(afterFirst, 'm-b')
    expect(afterSecond.sort()).toEqual(['m-a', 'm-b'])
  })
})
