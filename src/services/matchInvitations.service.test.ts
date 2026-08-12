jest.mock('@/lib/posthog', () => ({
  posthog: { identify: jest.fn(), reset: jest.fn(), capture: jest.fn() },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}))

import { posthog } from '@/lib/posthog'
import { supabase } from '@/lib/supabase'
import {
  cancelMatchInvitation,
  inviteFriendToMatch,
  listMatchInvitations,
  listMyMatchInvitations,
  respondMatchInvitation,
} from '@/services/matchInvitations.service'

function mockRpc(result: { data: unknown; error: unknown }) {
  ;(supabase.rpc as jest.Mock).mockResolvedValue(result)
}

describe('matchInvitations.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('inviteFriendToMatch tracks the event on success', async () => {
    mockRpc({ data: 'inv-1', error: null })
    const id = await inviteFriendToMatch('m-1', 'u-2', 'B')
    expect(id).toBe('inv-1')
    expect(supabase.rpc).toHaveBeenCalledWith('invite_friend_to_match', {
      p_match_id: 'm-1',
      p_invitee_id: 'u-2',
      p_team: 'B',
    })
    expect(posthog.capture).toHaveBeenCalledWith('match_invite_sent', {
      match_id: 'm-1',
      invitee_id: 'u-2',
      team: 'B',
    })
  })

  it('inviteFriendToMatch maps team_capacity_exceeded', async () => {
    mockRpc({ data: null, error: { message: 'team_capacity_exceeded' } })
    await expect(inviteFriendToMatch('m-1', 'u-2', 'A')).rejects.toThrow(
      'Ese equipo ya está completo'
    )
  })

  it('inviteFriendToMatch maps not_friends', async () => {
    mockRpc({ data: null, error: { message: 'not_friends' } })
    await expect(inviteFriendToMatch('m-1', 'u-2', 'A')).rejects.toThrow(
      'Solo puedes invitar a tus amigos'
    )
  })

  it('inviteFriendToMatch maps not_standalone_match', async () => {
    mockRpc({ data: null, error: { message: 'not_standalone_match' } })
    await expect(inviteFriendToMatch('m-1', 'u-2', 'A')).rejects.toThrow(
      'Las partidas de torneo o liga no admiten invitaciones'
    )
  })

  it('respondMatchInvitation tracks accepted event', async () => {
    mockRpc({ data: null, error: null })
    await respondMatchInvitation('inv-1', true, { matchId: 'm-1', team: 'B' })
    expect(supabase.rpc).toHaveBeenCalledWith('respond_match_invitation', {
      p_invitation_id: 'inv-1',
      p_accept: true,
    })
    expect(posthog.capture).toHaveBeenCalledWith('match_invite_accepted', {
      match_id: 'm-1',
      team: 'B',
    })
  })

  it('respondMatchInvitation does not track on reject', async () => {
    mockRpc({ data: null, error: null })
    await respondMatchInvitation('inv-1', false)
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('cancelMatchInvitation maps match_already_started', async () => {
    mockRpc({ data: null, error: { message: 'match_already_started' } })
    await expect(cancelMatchInvitation('inv-1')).rejects.toThrow(
      'La partida ya ha empezado; el invitado debe aceptar o rechazar la invitación'
    )
  })

  it('listMyMatchInvitations returns the rpc data', async () => {
    mockRpc({ data: [{ invitation_id: 'inv-1', match_id: 'm-1' }], error: null })
    const rows = await listMyMatchInvitations()
    expect(rows).toEqual([{ invitation_id: 'inv-1', match_id: 'm-1' }])
  })

  it('listMatchInvitations forwards match id', async () => {
    mockRpc({ data: [], error: null })
    await listMatchInvitations('m-1')
    expect(supabase.rpc).toHaveBeenCalledWith('list_match_invitations', {
      p_match_id: 'm-1',
    })
  })
})
