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
  respondFriendRequest,
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
    mockRpc({ data: 'fs-1', error: null })
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

  it('sendFriendRequest trims a non-empty message', async () => {
    mockRpc({ data: 'fs-2', error: null })
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

  it('listMyFriends returns the rpc data array', async () => {
    mockRpc({ data: [{ user_id: 'u1', display_name: 'A' }], error: null })
    const friends = await listMyFriends()
    expect(friends).toEqual([{ user_id: 'u1', display_name: 'A' }])
  })

  it('listMyFriendRequests forwards direction', async () => {
    mockRpc({ data: [], error: null })
    await listMyFriendRequests('sent')
    expect(supabase.rpc).toHaveBeenCalledWith('list_my_friend_requests', {
      p_direction: 'sent',
    })
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
})
