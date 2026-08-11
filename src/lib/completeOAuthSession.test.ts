jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn(() => ({
    params: {},
    errorCode: null,
  })),
}))

import * as QueryParams from 'expo-auth-session/build/QueryParams'
import { supabase } from '@/lib/supabase'
import { completeOAuthSessionFromCallbackUrl, waitForAuthSession } from '@/lib/completeOAuthSession'

const mockSupabase = supabase as unknown as {
  auth: {
    exchangeCodeForSession: jest.Mock
    setSession: jest.Mock
    getSession: jest.Mock
  }
}

describe('completeOAuthSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('completeOAuthSessionFromCallbackUrl', () => {
    it('exchanges PKCE code for session', async () => {
      jest.mocked(QueryParams.getQueryParams).mockReturnValueOnce({
        params: { code: 'abc123' },
        errorCode: null,
      })
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null })

      const result = await completeOAuthSessionFromCallbackUrl(
        'jugamus://auth/callback?code=abc123'
      )

      expect(result.error).toBeNull()
      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    })

    it('sets session from access and refresh tokens', async () => {
      jest.mocked(QueryParams.getQueryParams).mockReturnValueOnce({
        params: { access_token: 'at', refresh_token: 'rt' },
        errorCode: null,
      })
      mockSupabase.auth.setSession.mockResolvedValue({ error: null })

      const result = await completeOAuthSessionFromCallbackUrl(
        'jugamus://auth/callback#access_token=at&refresh_token=rt'
      )

      expect(result.error).toBeNull()
      expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'at',
        refresh_token: 'rt',
      })
    })

    it('returns error when callback lacks session data', async () => {
      const result = await completeOAuthSessionFromCallbackUrl('jugamus://auth/callback')
      expect(result.error?.message).toContain('no incluye sesión')
    })
  })

  describe('waitForAuthSession', () => {
    it('returns true when session appears', async () => {
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null })

      await expect(waitForAuthSession(1000, 10)).resolves.toBe(true)
    })

    it('returns false on timeout', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

      await expect(waitForAuthSession(50, 10)).resolves.toBe(false)
    })
  })
})
