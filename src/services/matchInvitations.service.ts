import { trackMatchInviteAccepted, trackMatchInviteSent } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MyMatchInvitationRow = {
  invitation_id: string
  match_id: string
  title: string
  start_at: string
  match_status: string
  inviter_id: string
  inviter_name: string
  team: string
  created_at: string
}

export type MatchInvitationRow = {
  invitation_id: string
  invitee_id: string
  invitee_name: string
  team: string
  status: string
  created_at: string
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapInviteRpcError(message: string): string {
  if (message.includes('not_authenticated')) return 'Debes iniciar sesión'
  if (message.includes('invitee_required')) return 'Selecciona un amigo'
  if (message.includes('cannot_invite_self')) return 'No puedes invitarte a ti mismo'
  if (message.includes('match_not_found')) return 'Partida no encontrada'
  if (message.includes('not_standalone_match')) {
    return 'Las partidas de torneo o liga no admiten invitaciones'
  }
  if (message.includes('not_creator')) return 'Solo el creador puede invitar a esta partida'
  if (message.includes('invalid_match_status')) {
    return 'La partida ya no admite invitaciones'
  }
  if (message.includes('not_friends')) return 'Solo puedes invitar a tus amigos'
  if (message.includes('already_participant')) return 'Este amigo ya participa en la partida'
  if (message.includes('team_capacity_exceeded')) return 'Ese equipo ya está completo'
  if (message.includes('invitation_already_pending')) return 'Ya has invitado a este amigo'
  if (message.includes('invitation_already_accepted')) return 'Este amigo ya aceptó la invitación'
  if (message.includes('invitation_not_found')) return 'Invitación no encontrada'
  if (message.includes('not_invitee')) return 'No puedes responder a esta invitación'
  if (message.includes('not_inviter')) return 'Solo puedes cancelar tus propias invitaciones'
  if (message.includes('not_pending')) return 'Esta invitación ya no está pendiente'
  if (message.includes('match_already_started')) {
    return 'La partida ya ha empezado; el invitado debe aceptar o rechazar la invitación'
  }
  return message
}

// ─── RPCs ─────────────────────────────────────────────────────────────────────

export async function inviteFriendToMatch(
  matchId: string,
  inviteeId: string,
  team: string
): Promise<string> {
  const { data, error } = await supabase.rpc('invite_friend_to_match', {
    p_match_id: matchId,
    p_invitee_id: inviteeId,
    p_team: team,
  })
  if (error) throw new Error(mapInviteRpcError(error.message))
  if (!data) throw new Error('No se pudo enviar la invitación')
  trackMatchInviteSent(matchId, inviteeId, team)
  return data as string
}

export async function respondMatchInvitation(
  invitationId: string,
  accept: boolean,
  meta?: { matchId: string; team: string }
): Promise<void> {
  const { error } = await supabase.rpc('respond_match_invitation', {
    p_invitation_id: invitationId,
    p_accept: accept,
  })
  if (error) throw new Error(mapInviteRpcError(error.message))
  if (accept) {
    trackMatchInviteAccepted(meta?.matchId, meta?.team ?? '')
  }
}

export async function cancelMatchInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_match_invitation', {
    p_invitation_id: invitationId,
  })
  if (error) throw new Error(mapInviteRpcError(error.message))
}

export async function listMyMatchInvitations(): Promise<MyMatchInvitationRow[]> {
  const { data, error } = await supabase.rpc('list_my_match_invitations')
  if (error) throw new Error(mapInviteRpcError(error.message))
  return (data ?? []) as MyMatchInvitationRow[]
}

export async function listMatchInvitations(matchId: string): Promise<MatchInvitationRow[]> {
  const { data, error } = await supabase.rpc('list_match_invitations', {
    p_match_id: matchId,
  })
  if (error) throw new Error(mapInviteRpcError(error.message))
  return (data ?? []) as MatchInvitationRow[]
}
