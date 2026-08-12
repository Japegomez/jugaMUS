/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import {
  friendRequestsQueryKey,
  friendsQueryKey,
  friendshipWithUserQueryKey,
  invalidateFriendsQueries,
  useMyFriendRequests,
  useMyFriends,
  useRespondFriendRequest,
  useSendFriendRequest,
  userSearchQueryKey,
} from '@/hooks/useFriends'

jest.mock('@/services/friends.service', () => ({
  listMyFriends: jest.fn(),
  listMyFriendRequests: jest.fn(),
  sendFriendRequest: jest.fn(),
  respondFriendRequest: jest.fn(),
  cancelFriendRequest: jest.fn(),
  removeFriend: jest.fn(),
  getFriendshipWithUser: jest.fn(),
  searchUsersByDisplayName: jest.fn(),
}))

import {
  listMyFriendRequests,
  listMyFriends,
  respondFriendRequest,
  sendFriendRequest,
} from '@/services/friends.service'

const mockListMyFriends = listMyFriends as jest.Mock
const mockListMyFriendRequests = listMyFriendRequests as jest.Mock
const mockSendFriendRequest = sendFriendRequest as jest.Mock
const mockRespondFriendRequest = respondFriendRequest as jest.Mock

describe('friends query keys', () => {
  it('builds stable keys', () => {
    expect(friendsQueryKey('u1')).toEqual(['friends', 'u1'])
    expect(friendRequestsQueryKey('u1', 'received')).toEqual(['friend-requests', 'u1', 'received'])
    expect(friendshipWithUserQueryKey('u1', 'u2')).toEqual(['friendship-with-user', 'u1', 'u2'])
    expect(userSearchQueryKey('u1', 'ana')).toEqual(['user-search', 'u1', 'ana'])
  })
})

describe('invalidateFriendsQueries', () => {
  it('invalidates friends-related keys for user', () => {
    const { queryClient } = renderHookWithClient(() => null)
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateFriendsQueries(queryClient, 'u1')

    expect(spy).toHaveBeenCalledWith({ queryKey: friendsQueryKey('u1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['friend-requests', 'u1'] })
  })

  it('no-ops without userId', () => {
    const { queryClient } = renderHookWithClient(() => null)
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    invalidateFriendsQueries(queryClient)

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useMyFriends', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('loads friends for session user', async () => {
    const friends = [{ id: 'f1', display_name: 'Ana' }]
    mockListMyFriends.mockResolvedValue(friends)

    const { result } = renderHookWithClient(() => useMyFriends())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(friends)
    expect(mockListMyFriends).toHaveBeenCalled()
  })
})

describe('useMyFriendRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('loads received requests', async () => {
    const rows = [{ id: 'r1', status: 'pending' }]
    mockListMyFriendRequests.mockResolvedValue(rows)

    const { result } = renderHookWithClient(() => useMyFriendRequests('received'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(mockListMyFriendRequests).toHaveBeenCalledWith('received')
  })
})

describe('useSendFriendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('sends request and invalidates friends queries', async () => {
    mockSendFriendRequest.mockResolvedValue({ friendship_id: 'fr1', status: 'pending' })
    const { result, queryClient } = renderHookWithClient(() => useSendFriendRequest())
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ addresseeId: 'u2', message: 'Hola' })
    })

    expect(mockSendFriendRequest).toHaveBeenCalledWith('u2', 'Hola')
    expect(spy).toHaveBeenCalledWith({ queryKey: friendsQueryKey('user-1') })
  })
})

describe('useRespondFriendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('accepts request', async () => {
    mockRespondFriendRequest.mockResolvedValue(undefined)
    const { result } = renderHookWithClient(() => useRespondFriendRequest())

    await act(async () => {
      await result.current.mutateAsync({ friendshipId: 'fr1', accept: true })
    })

    expect(mockRespondFriendRequest).toHaveBeenCalledWith('fr1', true)
  })
})
