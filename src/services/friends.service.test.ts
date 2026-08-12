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
  cancelFriendRequest,
  getFriendshipWithUser,
  listMyFriendRequests,
  listMyFriends,
  removeFriend,
  respondFriendRequest,
  searchUsersByDisplayName,
  sendFriendRequest,
} from '@/services/friends.service'

type RpcArgs = Record<string, unknown>

function mockRpc(result: { data: unknown; error: unknown }) {
  ;(supabase.rpc as jest.Mock).mockResolvedValue(result)
}

function lastRpcArgs(): RpcArgs {
  const calls = (supabase.rpc as jest.Mock).mock.calls
  return calls[calls.length - 1][1] as RpcArgs
}

describe('friends.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sendFriendRequest sends empty message as undefined and tracks event', async () => {
    mockRpc({ data: [{ friendship_id: 'fs-1', status: 'pending' }], error: null })
    const id = await sendFriendRequest('user-2', '   ')
    expect(id).toBe('fs-1')
    expect(supabase.rpc).toHaveBeenCalledWith('send_friend_request', {
      p_addressee_id: 'user-2',
      p_message: undefined,
    })
    expect(posthog.capture).toHaveBeenCalledWith('friend_request_sent', {
      addressee_id: 'user-2',
    })
  })

  it('sendFriendRequest tracks accepted when auto-accept occurs', async () => {
    mockRpc({ data: [{ friendship_id: 'fs-auto', status: 'accepted' }], error: null })
    const id = await sendFriendRequest('user-2')
    expect(id).toBe('fs-auto')
    expect(posthog.capture).toHaveBeenCalledWith('friend_request_accepted', {
      addressee_id: 'user-2',
    })
  })

  it('sendFriendRequest rejects when rpc returns null data', async () => {
    mockRpc({ data: null, error: null })
    await expect(sendFriendRequest('user-2')).rejects.toThrow('No se pudo enviar la solicitud')
  })

  it('sendFriendRequest trims a non-empty message', async () => {
    mockRpc({ data: [{ friendship_id: 'fs-2', status: 'pending' }], error: null })
    await sendFriendRequest('user-3', '  hola  ')
    expect(lastRpcArgs()).toEqual({ p_addressee_id: 'user-3', p_message: 'hola' })
  })

  it('sendFriendRequest maps known rpc errors to friendly messages', async () => {
    mockRpc({ data: null, error: { message: 'already_friends' } })
    await expect(sendFriendRequest('user-4')).rejects.toThrow('Ya sois amigos')
  })

  it('sendFriendRequest surfaces unknown errors verbatim', async () => {
    mockRpc({ data: null, error: { message: 'something_else' } })
    await expect(sendFriendRequest('user-5')).rejects.toThrow('something_else')
  })

  it('respondFriendRequest forwards accept flag', async () => {
    mockRpc({ data: null, error: null })
    await respondFriendRequest('fs-1', false)
    expect(supabase.rpc).toHaveBeenCalledWith('respond_friend_request', {
      p_friendship_id: 'fs-1',
      p_accept: false,
    })
  })

  it('cancelFriendRequest maps not_requester', async () => {
    mockRpc({ data: null, error: { message: 'not_requester' } })
    await expect(cancelFriendRequest('fs-9')).rejects.toThrow(
      'Solo puedes cancelar tus propias solicitudes'
    )
  })

  it('removeFriend forwards the other user id', async () => {
    mockRpc({ data: null, error: null })
    await removeFriend('u-other')
    expect(supabase.rpc).toHaveBeenCalledWith('remove_friend', {
      p_other_user_id: 'u-other',
    })
  })

  it('removeFriend maps friendship_not_found', async () => {
    mockRpc({ data: null, error: { message: 'friendship_not_found' } })
    await expect(removeFriend('u-other')).rejects.toThrow('Solicitud no encontrada')
  })

  it('removeFriend maps cannot_remove_self', async () => {
    mockRpc({ data: null, error: { message: 'cannot_remove_self' } })
    await expect(removeFriend('u-self')).rejects.toThrow('No puedes eliminarte a ti mismo')
  })

  it('listMyFriends returns the rpc data array', async () => {
    mockRpc({ data: [{ user_id: 'u1', display_name: 'A' }], error: null })
    const friends = await listMyFriends()
    expect(friends).toEqual([{ user_id: 'u1', display_name: 'A' }])
  })

  it('listMyFriends returns [] when rpc data is null', async () => {
    mockRpc({ data: null, error: null })
    await expect(listMyFriends()).resolves.toEqual([])
  })

  it('listMyFriendRequests forwards direction', async () => {
    mockRpc({ data: [], error: null })
    await listMyFriendRequests('sent')
    expect(supabase.rpc).toHaveBeenCalledWith('list_my_friend_requests', {
      p_direction: 'sent',
    })
  })

  it('listMyFriendRequests returns [] when rpc data is null', async () => {
    mockRpc({ data: null, error: null })
    await expect(listMyFriendRequests('received')).resolves.toEqual([])
  })

  it('getFriendshipWithUser returns null status when no row', async () => {
    mockRpc({ data: [], error: null })
    const f = await getFriendshipWithUser('u-other')
    expect(f).toEqual({ friendship_id: null, status: null, direction: null })
  })

  it('getFriendshipWithUser maps the returned row', async () => {
    mockRpc({
      data: [{ friendship_id: 'fs-1', status: 'pending', direction: 'sent' }],
      error: null,
    })
    const f = await getFriendshipWithUser('u-other')
    expect(f).toEqual({
      friendship_id: 'fs-1',
      status: 'pending',
      direction: 'sent',
    })
  })

  it('searchUsersByDisplayName returns empty for short queries without rpc', async () => {
    const hits = await searchUsersByDisplayName('a')
    expect(hits).toEqual([])
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('searchUsersByDisplayName maps friendship fields', async () => {
    mockRpc({
      data: [
        {
          user_id: 'u2',
          display_name: 'Ana',
          city: 'Madrid',
          photo_url: null,
          friendship_status: 'pending',
          friendship_direction: 'sent',
        },
      ],
      error: null,
    })
    const hits = await searchUsersByDisplayName('an')
    expect(supabase.rpc).toHaveBeenCalledWith('search_users_by_display_name', {
      p_query: 'an',
      p_limit: 20,
    })
    expect(hits).toEqual([
      {
        user_id: 'u2',
        display_name: 'Ana',
        city: 'Madrid',
        photo_url: null,
        friendship_status: 'pending',
        friendship_direction: 'sent',
      },
    ])
  })
})
