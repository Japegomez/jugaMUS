import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { QUERY_STALE_TIME } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import {
  cancelFriendRequest,
  getFriendshipWithUser,
  listMyFriendRequests,
  listMyFriends,
  removeFriend,
  respondFriendRequest,
  searchUsersByDisplayName,
  sendFriendRequest,
  type FriendRequestRow,
  type FriendSummary,
  type FriendshipStatus,
  type UserSearchHit,
} from '@/services/friends.service'

// ─── Query keys ──────────────────────────────────────────────────────────────

const FRIENDS_KEY = 'friends' as const
const FRIEND_REQUESTS_KEY = 'friend-requests' as const
const FRIENDSHIP_WITH_USER_KEY = 'friendship-with-user' as const
const USER_SEARCH_KEY = 'user-search' as const

export function friendsQueryKey(userId: string) {
  return [FRIENDS_KEY, userId] as const
}

export function friendRequestsQueryKey(userId: string, direction: 'sent' | 'received') {
  return [FRIEND_REQUESTS_KEY, userId, direction] as const
}

export function friendshipWithUserQueryKey(userId: string, otherUserId: string) {
  return [FRIENDSHIP_WITH_USER_KEY, userId, otherUserId] as const
}

export function userSearchQueryKey(userId: string, query: string) {
  return [USER_SEARCH_KEY, userId, query] as const
}

function invalidateFriendsQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  if (!userId) return
  queryClient.invalidateQueries({ queryKey: friendsQueryKey(userId) })
  queryClient.invalidateQueries({ queryKey: [FRIEND_REQUESTS_KEY, userId] })
  queryClient.invalidateQueries({ queryKey: [FRIENDSHIP_WITH_USER_KEY, userId] })
  queryClient.invalidateQueries({ queryKey: [USER_SEARCH_KEY, userId] })
}

export { invalidateFriendsQueries }

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMyFriends() {
  const userId = useAuthStore((s) => s.session?.user.id)
  return useQuery({
    queryKey: friendsQueryKey(userId ?? ''),
    queryFn: () => listMyFriends(),
    enabled: Boolean(userId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useMyFriendRequests(direction: 'sent' | 'received') {
  const userId = useAuthStore((s) => s.session?.user.id)
  return useQuery<FriendRequestRow[]>({
    queryKey: friendRequestsQueryKey(userId ?? '', direction),
    queryFn: () => listMyFriendRequests(direction),
    enabled: Boolean(userId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useFriendshipWithUser(otherUserId: string | undefined) {
  const userId = useAuthStore((s) => s.session?.user.id)
  return useQuery<FriendshipStatus>({
    queryKey: friendshipWithUserQueryKey(userId ?? '', otherUserId ?? ''),
    queryFn: () => getFriendshipWithUser(otherUserId!),
    enabled: Boolean(userId && otherUserId),
    staleTime: QUERY_STALE_TIME,
  })
}

export function useSearchUsersByDisplayName(query: string) {
  const userId = useAuthStore((s) => s.session?.user.id)
  const trimmed = query.trim()
  return useQuery<UserSearchHit[]>({
    queryKey: userSearchQueryKey(userId ?? '', trimmed),
    queryFn: () => searchUsersByDisplayName(trimmed),
    enabled: Boolean(userId) && trimmed.length >= 2,
    staleTime: 15_000,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useSendFriendRequest() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({ addresseeId, message }: { addresseeId: string; message?: string }) =>
      sendFriendRequest(addresseeId, message),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  })
}

export function useRespondFriendRequest() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) =>
      respondFriendRequest(friendshipId, accept),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  })
}

export function useCancelFriendRequest() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: (friendshipId: string) => cancelFriendRequest(friendshipId),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  })
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.session?.user.id)
  return useMutation({
    mutationFn: (otherUserId: string) => removeFriend(otherUserId),
    onSuccess: () => invalidateFriendsQueries(queryClient, userId),
  })
}

export type { FriendSummary, FriendRequestRow, FriendshipStatus, UserSearchHit }
