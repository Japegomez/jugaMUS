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
  sendFriendRequest,
  type FriendRequestRow,
  type FriendSummary,
  type FriendshipStatus,
} from '@/services/friends.service'

// ─── Query keys ──────────────────────────────────────────────────────────────

export function friendsQueryKey(userId: string) {
  return ['friends', userId] as const
}

export function friendRequestsQueryKey(userId: string, direction: 'sent' | 'received') {
  return ['friend-requests', userId, direction] as const
}

export function friendshipWithUserQueryKey(userId: string, otherUserId: string) {
  return ['friendship-with-user', userId, otherUserId] as const
}

function invalidateFriendsQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  if (!userId) return
  queryClient.invalidateQueries({ queryKey: friendsQueryKey(userId) })
  queryClient.invalidateQueries({ queryKey: ['friend-requests', userId] })
  queryClient.invalidateQueries({ queryKey: ['friendship-with-user', userId] })
}

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

export type { FriendSummary, FriendRequestRow, FriendshipStatus }
