import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

jest.mock('@/lib/analytics', () => ({
  identifyUser: jest.fn(),
  resetAnalytics: jest.fn(),
  trackUserSignedUp: jest.fn(),
  isLikelyNewAuthUser: jest.fn(() => false),
}))

jest.mock('@/lib/authRedirect', () => ({
  getOAuthRedirectUrl: jest.fn(() => 'jugamus://auth/callback'),
  getPasswordResetRedirectUrl: jest.fn(() => 'jugamus://auth/update-password'),
}))

jest.mock('@/lib/oauth', () => ({
  signInWithOAuthProvider: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/lib/sessionBackground', () => ({
  clearSessionBackgroundMarker: jest.fn(async () => undefined),
}))

jest.mock('@/lib/validateAuthSession', () => ({
  validateAuthSession: jest.fn(async (session) => ({ session, expired: false })),
  SESSION_EXPIRED_MESSAGE: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
}))

jest.mock('@/lib/syncAppleProfileDisplayName', () => ({
  syncAppleProfileDisplayName: jest.fn(async () => undefined),
}))

jest.mock('@/lib/syncOAuthProfilePhoto', () => ({
  syncOAuthProfilePhoto: jest.fn(async () => undefined),
}))

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))

import { identifyUser } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'

const mockSupabase = supabase as ReturnType<typeof createSupabaseMock>

function resetAuthStore() {
  useAuthStore.setState({
    session: null,
    initialized: false,
    passwordRecoveryPending: false,
    pendingInviteHref: null,
    lastAuthMessage: null,
  })
}

function mockProfileStatus(status: string | null) {
  mockSupabase.from.mockReturnValue(
    mockFromChain({ data: status ? { status } : null, error: null })
  )
}

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetAuthStore()
    mockProfileStatus('active')
  })

  describe('signInWithPassword', () => {
    it('maps invalid credentials to Spanish message', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      const { error } = await useAuthStore.getState().signInWithPassword('a@b.com', 'wrong')

      expect(error?.message).toBe('Email o contraseña incorrectos')
    })

    it('maps 429 rate limit to user-facing message', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Too many requests', status: 429 },
      })

      const { error } = await useAuthStore.getState().signInWithPassword('a@b.com', 'pass')

      expect(error?.message).toContain('Límite temporal alcanzado')
    })

    it('returns suspended profile message and signs out', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1' }, session: null },
        error: null,
      })
      mockProfileStatus('suspended')

      const { error } = await useAuthStore.getState().signInWithPassword('a@b.com', 'pass')

      expect(error?.message).toBe('Tu cuenta está suspendida. Contacta con soporte.')
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('identifies user on successful sign-in', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1' }, session: null },
        error: null,
      })

      const { error } = await useAuthStore.getState().signInWithPassword('a@b.com', 'pass')

      expect(error).toBeNull()
      expect(identifyUser).toHaveBeenCalledWith('user-1')
    })
  })

  describe('signUp', () => {
    it('maps weak password errors', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Password should be at least 8 characters', code: 'weak_password' },
      })

      const { error } = await useAuthStore.getState().signUp({
        email: 'a@b.com',
        password: 'short',
        displayName: 'Test User',
      })

      expect(error?.message).toBe('La contraseña no cumple los requisitos de seguridad')
    })
  })

  describe('updatePassword', () => {
    it('maps same_password code', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'same_password', code: 'same_password', status: 422 },
      })

      const { error } = await useAuthStore.getState().updatePassword('OldPass123')

      expect(error?.message).toBe('La nueva contraseña debe ser distinta de la actual')
    })
  })
})
