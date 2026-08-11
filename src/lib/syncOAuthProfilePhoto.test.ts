import { mockFromChain } from '@/__test-utils__/supabaseMock'

jest.mock('@/lib/oauthAvatar', () => ({
  resolveOAuthAvatarUrlFromUser: jest.fn(() => 'https://example.com/avatar.jpg'),
}))

jest.mock('@/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}))

jest.mock('@/services/profiles.service', () => ({
  uploadAvatar: jest.fn(async () => 'https://cdn.example/avatar.png'),
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: null,
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

import { queryClient } from '@/lib/queryClient'
import { resolveOAuthAvatarUrlFromUser } from '@/lib/oauthAvatar'
import { uploadAvatar } from '@/services/profiles.service'
import { supabase } from '@/lib/supabase'
import { syncOAuthProfilePhoto } from '@/lib/syncOAuthProfilePhoto'

const mockSupabase = supabase as unknown as { from: jest.Mock }

describe('syncOAuthProfilePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(resolveOAuthAvatarUrlFromUser as jest.Mock).mockReturnValue('https://example.com/avatar.jpg')
  })

  it('returns false when user has no remote avatar', async () => {
    ;(resolveOAuthAvatarUrlFromUser as jest.Mock).mockReturnValueOnce(null)

    const result = await syncOAuthProfilePhoto({ id: 'u1' } as never)

    expect(result).toBe(false)
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('returns false when profile already has photo_url', async () => {
    mockSupabase.from.mockReturnValueOnce(
      mockFromChain({ data: { photo_url: 'https://existing.png' }, error: null })
    )

    const result = await syncOAuthProfilePhoto({ id: 'u1' } as never)

    expect(result).toBe(false)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('uploads avatar and invalidates profile cache on success (web path)', async () => {
    mockSupabase.from.mockReturnValueOnce(mockFromChain({ data: { photo_url: '' }, error: null }))

    const result = await syncOAuthProfilePhoto({ id: 'u1' } as never)

    expect(result).toBe(true)
    expect(uploadAvatar).toHaveBeenCalledWith('u1', 'https://example.com/avatar.jpg', null, {
      onlyIfEmpty: true,
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['profile', 'u1'],
    })
  })
})
