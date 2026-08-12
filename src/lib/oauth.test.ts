import { Platform } from 'react-native'

/**
 * oauth.ts is tightly coupled to WebBrowser and Linking; we cover the env guard only.
 * Full native OAuth flow needs integration tests (module caches anon key at load time).
 */

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(async () => ({ error: null })),
    },
  },
}))

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}))

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `jugamus://${path}`),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}))

jest.mock('@/lib/authRedirect', () => ({
  getOAuthRedirectUrl: jest.fn(() => 'jugamus://auth/callback'),
  NATIVE_OAUTH_REDIRECT_EXAMPLE: 'jugamus://auth/callback',
}))

jest.mock('@/lib/completeOAuthSession', () => ({
  completeOAuthSessionFromCallbackUrl: jest.fn(async () => ({ error: null })),
}))

import { signInWithOAuthProvider } from '@/lib/oauth'

describe('signInWithOAuthProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns error when Supabase env vars are missing', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

    const result = await signInWithOAuthProvider('google')

    expect(result.error?.message).toContain('EXPO_PUBLIC_SUPABASE_URL')
  })
})
