import { trackFriendRequestSent } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FriendSummary = {
  user_id: string
  display_name: string
  city: string | null
  photo_url: string | null
  since: string
}

export type FriendRequestRow = {
  friendship_id: string
  user_id: string
  display_name: string
  city: string | null
  photo_url: string | null
  message: string | null
  created_at: string
}

export type FriendshipStatus = {
  friendship_id: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | null
  direction: 'sent' | 'received' | null
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapFriendRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'Debes iniciar sesión'
  if (message.includes('cannot_friend_self')) return 'No puedes enviarte una solicitud a ti mismo'
  if (message.includes('addressee_not_found')) return 'Este usuario ya no está disponible'
  if (message.includes('addressee_required')) return 'Selecciona un usuario'
  if (message.includes('already_friends')) return 'Ya sois amigos'
  if (message.includes('request_already_pending'))
    return 'Ya hay una solicitud pendiente entre vosotros'
  if (message.includes('friendship_not_found')) return 'Solicitud no encontrada'
  if (message.includes('not_addressee')) return 'No puedes responder a esta solicitud'
  if (message.includes('not_requester')) return 'Solo puedes cancelar tus propias solicitudes'
  if (message.includes('not_pending')) return 'Esta solicitud ya no está pendiente'
  return message
}

// ─── RPCs ─────────────────────────────────────────────────────────────────────

export async function sendFriendRequest(addresseeId: string, message?: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
    p_message: message?.trim() ? message.trim() : undefined,
  })
  if (error) throw new Error(mapFriendRpcError(error.message))
  if (!data) throw new Error('No se pudo enviar la solicitud')
  trackFriendRequestSent(addresseeId)
  return data as string
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  })
  if (error) throw new Error(mapFriendRpcError(error.message))
}

export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_friend_request', {
    p_friendship_id: friendshipId,
  })
  if (error) throw new Error(mapFriendRpcError(error.message))
}

export async function listMyFriends(): Promise<FriendSummary[]> {
  const { data, error } = await supabase.rpc('list_my_friends')
  if (error) throw new Error(mapFriendRpcError(error.message))
  return (data ?? []) as FriendSummary[]
}

export async function listMyFriendRequests(
  direction: 'sent' | 'received'
): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase.rpc('list_my_friend_requests', {
    p_direction: direction,
  })
  if (error) throw new Error(mapFriendRpcError(error.message))
  return (data ?? []) as FriendRequestRow[]
}

export async function getFriendshipWithUser(otherUserId: string): Promise<FriendshipStatus> {
  const { data, error } = await supabase.rpc('get_friendship_with_user', {
    p_other_user_id: otherUserId,
  })
  if (error) throw new Error(mapFriendRpcError(error.message))
  const row = (data ?? [])[0] as
    { friendship_id: string; status: string; direction: string } | undefined
  if (!row) {
    return { friendship_id: null, status: null, direction: null }
  }
  return {
    friendship_id: row.friendship_id,
    status: row.status as FriendshipStatus['status'],
    direction: row.direction as FriendshipStatus['direction'],
  }
}
