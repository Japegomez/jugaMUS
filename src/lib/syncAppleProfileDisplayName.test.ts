import { mockFromChain } from '@/__test-utils__/supabaseMock'

jest.mock('@/lib/appleDisplayName', () => ({
  resolveAppleProfileDisplayName: jest.fn(() => 'Ana Apple'),
}))

import { resolveAppleProfileDisplayName } from '@/lib/appleDisplayName'
import { supabase } from '@/lib/supabase'
import { syncAppleProfileDisplayName } from '@/lib/syncAppleProfileDisplayName'

const mockSupabase = supabase as unknown as {
  from: jest.Mock
  auth: { updateUser: jest.Mock }
}

describe('syncAppleProfileDisplayName', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates profile and auth metadata when name changes', async () => {
    mockSupabase.from
      .mockReturnValueOnce(
        mockFromChain({ data: { display_name: 'user@privaterelay.appleid.com' }, error: null })
      )
      .mockReturnValueOnce(mockFromChain({ data: null, error: null }))

    mockSupabase.auth.updateUser.mockResolvedValue({ data: { user: null }, error: null })

    await syncAppleProfileDisplayName('user-1', {
      appleFullName: {
        namePrefix: null,
        givenName: 'Ana',
        middleName: null,
        familyName: 'López',
        nameSuffix: null,
        nickname: null,
      },
      email: 'ana@privaterelay.appleid.com',
    })

    expect(resolveAppleProfileDisplayName).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { display_name: 'Ana Apple', full_name: 'Ana Apple' },
    })
  })

  it('no-ops when profile fetch fails', async () => {
    mockSupabase.from.mockReturnValueOnce(mockFromChain({ data: null, error: { message: 'fail' } }))

    await syncAppleProfileDisplayName('user-1', {
      appleFullName: null,
      email: null,
    })

    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('does not throw when auth metadata update fails', async () => {
    mockSupabase.from
      .mockReturnValueOnce(
        mockFromChain({ data: { display_name: 'user@privaterelay.appleid.com' }, error: null })
      )
      .mockReturnValueOnce(mockFromChain({ data: null, error: null }))

    mockSupabase.auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'auth update failed' },
    })

    await expect(
      syncAppleProfileDisplayName('user-1', {
        appleFullName: {
          namePrefix: null,
          givenName: 'Ana',
          middleName: null,
          familyName: 'López',
          nameSuffix: null,
          nickname: null,
        },
        email: 'ana@privaterelay.appleid.com',
      })
    ).resolves.toBeUndefined()

    expect(mockSupabase.auth.updateUser).toHaveBeenCalled()
  })
})
