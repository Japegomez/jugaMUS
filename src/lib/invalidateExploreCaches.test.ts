import { QueryClient } from '@tanstack/react-query'

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
})
