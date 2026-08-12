import { QueryClient } from '@tanstack/react-query'

import {
  invalidateMatchInvitationQueries,
  matchInvitationsQueryKey,
  matchQueryKey,
  myMatchInvitationsQueryKey,
} from '@/lib/matchQueryKeys'

describe('matchQueryKeys', () => {
  it('builds match and invitation keys', () => {
    expect(matchQueryKey('m1')).toEqual(['match', 'm1'])
    expect(myMatchInvitationsQueryKey('u1')).toEqual(['my-match-invitations', 'u1'])
    expect(matchInvitationsQueryKey('m1')).toEqual(['match', 'm1', 'invitations'])
  })

  it('invalidates my invitations and per-match keys', () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateMatchInvitationQueries(queryClient, {
      userId: 'u1',
      matchId: 'm1',
      matchIds: ['m2'],
    })

    expect(spy).toHaveBeenCalledWith({ queryKey: myMatchInvitationsQueryKey('u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: matchInvitationsQueryKey('m1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: matchQueryKey('m1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: matchInvitationsQueryKey('m2') })
    expect(spy).toHaveBeenCalledWith({ queryKey: matchQueryKey('m2') })
  })

  it('no-ops invitation list invalidation without userId', () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateMatchInvitationQueries(queryClient, {})

    expect(spy).not.toHaveBeenCalled()
  })
})
