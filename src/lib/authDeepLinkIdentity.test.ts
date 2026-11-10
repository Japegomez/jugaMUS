import { peekSessionFromAuthCode, verifiedEmailFromAccessToken } from '@/lib/authDeepLinkIdentity'

const mockGetUser = jest.fn()
const mockExchangeCodeForSession = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  })),
}))

describe('authDeepLinkIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('returns email after the auth server validates the access token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'player@example.com' } },
      error: null,
    })

    await expect(verifiedEmailFromAccessToken('access-token')).resolves.toBe('player@example.com')
    expect(mockGetUser).toHaveBeenCalledWith('access-token')
  })

  it('returns null when token validation fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' },
    })

    await expect(verifiedEmailFromAccessToken('bad-token')).resolves.toBeNull()
  })

  it('peeks session email from a PKCE code without adopting it globally', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: { email: 'player@example.com' },
          access_token: 'at',
          refresh_token: 'rt',
        },
      },
      error: null,
    })

    await expect(peekSessionFromAuthCode('pkce-code')).resolves.toEqual({
      email: 'player@example.com',
      access_token: 'at',
      refresh_token: 'rt',
      error: null,
    })
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code')
  })

  it('returns an error when PKCE exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'exchange failed' },
    })

    await expect(peekSessionFromAuthCode('bad-code')).resolves.toEqual({
      email: null,
      access_token: null,
      refresh_token: null,
      error: expect.objectContaining({ message: 'exchange failed' }),
    })
  })
})
