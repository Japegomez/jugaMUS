/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import {
  matchInvitationsQueryKey,
  myMatchInvitationsQueryKey,
  useCancelMatchInvitation,
  useInviteFriendToMatch,
  useMatchInvitations,
  useMyMatchInvitations,
  useRespondMatchInvitation,
} from '@/hooks/useMatchInvitations'

jest.mock('@/hooks/useMatches', () => ({
  invalidateMyMatchesDashboard: jest.fn(),
}))

jest.mock('@/services/matchInvitations.service', () => ({
  listMyMatchInvitations: jest.fn(),
  listMatchInvitations: jest.fn(),
  inviteFriendToMatch: jest.fn(),
  respondMatchInvitation: jest.fn(),
  cancelMatchInvitation: jest.fn(),
}))

import { invalidateMyMatchesDashboard } from '@/hooks/useMatches'
import {
  cancelMatchInvitation,
  inviteFriendToMatch,
  listMatchInvitations,
  listMyMatchInvitations,
  respondMatchInvitation,
} from '@/services/matchInvitations.service'

const mockListMy = listMyMatchInvitations as jest.Mock
const mockListMatch = listMatchInvitations as jest.Mock
const mockInvite = inviteFriendToMatch as jest.Mock
const mockRespond = respondMatchInvitation as jest.Mock
const mockCancel = cancelMatchInvitation as jest.Mock
const mockInvalidateDashboard = invalidateMyMatchesDashboard as jest.Mock

describe('useMyMatchInvitations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('loads my invitations', async () => {
    const rows = [{ id: 'i1', match_id: 'm1' }]
    mockListMy.mockResolvedValue(rows)

    const { result } = renderHookWithClient(() => useMyMatchInvitations())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(mockListMy).toHaveBeenCalled()
  })
})

describe('useMatchInvitations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads invitations for a match', async () => {
    const rows = [{ id: 'i1', invitee_id: 'u2' }]
    mockListMatch.mockResolvedValue(rows)

    const { result } = renderHookWithClient(() => useMatchInvitations('m1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(mockListMatch).toHaveBeenCalledWith('m1')
  })
})

describe('useInviteFriendToMatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('invites friend and invalidates invitation queries', async () => {
    mockInvite.mockResolvedValue({ id: 'i1' })
    const { result, queryClient } = renderHookWithClient(() => useInviteFriendToMatch())
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ matchId: 'm1', inviteeId: 'u2', team: 'a' })
    })

    expect(mockInvite).toHaveBeenCalledWith('m1', 'u2', 'a')
    expect(spy).toHaveBeenCalledWith({ queryKey: myMatchInvitationsQueryKey('user-1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: matchInvitationsQueryKey('m1') })
    expect(mockInvalidateDashboard).toHaveBeenCalled()
  })
})

describe('useRespondMatchInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('accepts invitation with match context', async () => {
    mockRespond.mockResolvedValue(undefined)
    const { result } = renderHookWithClient(() => useRespondMatchInvitation())

    await act(async () => {
      await result.current.mutateAsync({
        invitationId: 'i1',
        accept: true,
        matchId: 'm1',
        team: 'b',
      })
    })

    expect(mockRespond).toHaveBeenCalledWith('i1', true, { matchId: 'm1', team: 'b' })
    expect(mockInvalidateDashboard).toHaveBeenCalled()
  })
})

describe('useCancelMatchInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('cancels and invalidates the match invitation query', async () => {
    mockCancel.mockResolvedValue(undefined)
    const { result, queryClient } = renderHookWithClient(() => useCancelMatchInvitation())
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ invitationId: 'i1', matchId: 'm1' })
    })

    expect(mockCancel).toHaveBeenCalledWith('i1')
    expect(spy).toHaveBeenCalledWith({ queryKey: matchInvitationsQueryKey('m1') })
    expect(mockInvalidateDashboard).toHaveBeenCalled()
  })
})
