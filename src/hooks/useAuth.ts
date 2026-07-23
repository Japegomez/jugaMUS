import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'

import { syncAppleProfileDisplayName } from '@/lib/syncAppleProfileDisplayName'
import {
  identifyUser,
  isLikelyNewAuthUser,
  resetAnalytics,
  trackUserSignedUp,
} from '@/lib/analytics'
import { getOAuthRedirectUrl, getPasswordResetRedirectUrl } from '@/lib/authRedirect'
import { signInWithOAuthProvider } from '@/lib/oauth'
import { clearSessionBackgroundMarker } from '@/lib/sessionBackground'
import { SESSION_EXPIRED_MESSAGE, validateAuthSession } from '@/lib/validateAuthSession'
import { supabase } from '@/lib/supabase'

let authSubscription: { unsubscribe: () => void } | null = null

/** Supabase Auth devuelve 429 si hay demasiados signUp / emails / login desde la misma IP. */
function userFacingAuthError(error: { message: string; status?: number; code?: string }): Error {
  const msg = error.message ?? ''
  const code = error.code ?? ''
  const st = typeof error.status === 'number' ? error.status : undefined
  if (/invalid login credentials|invalid_credentials/i.test(msg)) {
    return new Error('Email o contraseña incorrectos')
  }
  if (code === 'same_password' || /same_password|different from the old password/i.test(msg)) {
    return new Error('La nueva contraseña debe ser distinta de la actual')
  }
  if (code === 'weak_password' || /weak_password|password.*strength|at least/i.test(msg)) {
    return new Error('La contraseña no cumple los requisitos de seguridad')
  }
  if (code === 'reauthentication_needed' || /reauthentication_needed|reauthenticate/i.test(msg)) {
    return new Error('Debes volver a verificar tu identidad para cambiar la contraseña')
  }
  if (st === 429 || /429|rate limit|too many requests|too_many|over_email_send/i.test(msg)) {
    return new Error(
      'Límite temporal alcanzado (demasiadas peticiones). Espera 1–2 minutos, no pulses repetir varias veces, o prueba otra red. En cuentas de prueba, desactivar la confirmación por email en Supabase reduce estos límites.'
    )
  }
  return new Error(msg)
}

/** Returns a user-facing message if the profile is suspended; does not sign out (callers handle that). */
async function getProfileSuspendedMessage(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  if (data.status === 'suspended') {
    return 'Tu cuenta está suspendida. Contacta con soporte.'
  }

  return null
}

export interface SignUpParams {
  email: string
  password: string
  displayName: string
}

export interface AuthState {
  session: Session | null
  initialized: boolean
  /** True while the user must set a new password after a recovery email link. */
  passwordRecoveryPending: boolean
  /** Deep-link destination to restore after login (match/tournament invite). */
  pendingInviteHref: string | null
  lastAuthMessage: string | null
  setSession: (session: Session | null) => void
  setInitialized: (initialized: boolean) => void
  setPasswordRecoveryPending: (pending: boolean) => void
  setPendingInviteHref: (href: string | null) => void
  clearLastAuthMessage: () => void
  initializeAuth: () => void
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithApple: () => Promise<{ error: Error | null }>
  /** Revalidates the persisted session with Auth; signs out locally if it is stale. */
  ensureSessionValid: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  passwordRecoveryPending: false,
  pendingInviteHref: null,
  lastAuthMessage: null,

  setSession: (session) => set({ session }),
  setInitialized: (initialized) => set({ initialized }),
  setPasswordRecoveryPending: (pending) => set({ passwordRecoveryPending: pending }),
  setPendingInviteHref: (href) => set({ pendingInviteHref: href }),
  clearLastAuthMessage: () => set({ lastAuthMessage: null }),

  initializeAuth: () => {
    if (authSubscription) return

    // Single bootstrap path: INITIAL_SESSION owns validate + suspended checks.
    // Avoid racing getSession().then with onAuthStateChange INITIAL_SESSION.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        if (event === 'INITIAL_SESSION') {
          if (!session) {
            set({ session: null, initialized: true })
            return
          }

          const { session: validSession, expired } = await validateAuthSession(session)
          if (expired) {
            await clearSessionBackgroundMarker()
            set({
              session: null,
              initialized: true,
              passwordRecoveryPending: false,
              pendingInviteHref: null,
              lastAuthMessage: SESSION_EXPIRED_MESSAGE,
            })
            return
          }

          if (validSession?.user) {
            const suspendedMsg = await getProfileSuspendedMessage(validSession.user.id)
            if (suspendedMsg) {
              await supabase.auth.signOut()
              set({
                session: null,
                initialized: true,
                passwordRecoveryPending: false,
                lastAuthMessage: suspendedMsg,
              })
              return
            }
          }

          set({ session: validSession, initialized: true })
          return
        }

        // Set session immediately so root navigation does not treat the user as logged out
        // while we await the profile check (fixes OAuth returning to login).
        set({ session })
        if (!get().initialized) {
          set({ initialized: true })
        }

        if (event === 'PASSWORD_RECOVERY') {
          set({ passwordRecoveryPending: true })
        }

        if (event === 'SIGNED_IN') {
          void clearSessionBackgroundMarker()
        }

        if (event === 'SIGNED_OUT') {
          set({ passwordRecoveryPending: false })
          resetAnalytics()
        }

        const activeSession = get().session
        if (activeSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          if (event === 'SIGNED_IN') {
            identifyUser(activeSession.user.id)
            const provider = activeSession.user.app_metadata?.provider
            if (
              (provider === 'google' || provider === 'apple') &&
              isLikelyNewAuthUser(activeSession.user)
            ) {
              trackUserSignedUp(provider)
            }
          }
          const suspendedMsg = await getProfileSuspendedMessage(activeSession.user.id)
          if (suspendedMsg) {
            await supabase.auth.signOut()
            set({
              session: null,
              passwordRecoveryPending: false,
              lastAuthMessage: suspendedMsg,
            })
          }
        }
      })()
    })

    authSubscription = data.subscription
  },

  signInWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: userFacingAuthError(error) }
    }
    // Clear sticky recovery gate so a normal login is not forced back to update-password.
    set({ passwordRecoveryPending: false })
    if (data.user) {
      const suspendedMsg = await getProfileSuspendedMessage(data.user.id)
      if (suspendedMsg) {
        await supabase.auth.signOut()
        return { error: new Error(suspendedMsg) }
      }
      identifyUser(data.user.id)
    }
    return { error: null }
  },

  signUp: async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getOAuthRedirectUrl(),
        data: {
          display_name: displayName,
          phone_e164: '+34000000000',
        },
      },
    })
    if (error) {
      return { error: userFacingAuthError(error) }
    }
    trackUserSignedUp('email')
    const userId = data.user?.id ?? data.session?.user?.id
    if (userId) {
      identifyUser(userId)
    }
    return { error: null }
  },

  signOut: async () => {
    await clearSessionBackgroundMarker()
    await supabase.auth.signOut()
    resetAnalytics()
    set({ session: null, passwordRecoveryPending: false, pendingInviteHref: null })
  },

  deleteAccount: async () => {
    const { data, error } = await supabase.functions.invoke('delete-account')

    if (error) {
      return { error: new Error(error.message || 'No se pudo eliminar la cuenta') }
    }

    const payload = data as { error?: string; success?: boolean } | null
    if (payload?.error) {
      return { error: new Error(payload.error) }
    }

    await supabase.auth.signOut()
    resetAnalytics()
    set({ session: null })
    return { error: null }
  },

  resetPassword: async (email) => {
    const redirectTo = getPasswordResetRedirectUrl()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      return { error: userFacingAuthError(error) }
    }
    return { error: null }
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return {
        error: userFacingAuthError({
          message: error.message,
          status: error.status,
          code: error.code,
        }),
      }
    }
    await clearSessionBackgroundMarker()
    await supabase.auth.signOut()
    set({ session: null, passwordRecoveryPending: false })
    return { error: null }
  },

  signInWithGoogle: () => signInWithOAuthProvider('google'),

  signInWithApple: async () => {
    if (Platform.OS === 'web') {
      return signInWithOAuthProvider('apple')
    }

    if (Platform.OS !== 'ios') {
      return { error: new Error('Sign in with Apple solo está disponible en iOS y en la web') }
    }

    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      return { error: new Error('Sign in with Apple no está disponible en este dispositivo') }
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (!credential.identityToken) {
        return { error: new Error('No se obtuvo el token de identidad de Apple') }
      }

      const { data: appleData, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })

      if (error) {
        return { error: userFacingAuthError(error) }
      }

      const userId = appleData.user?.id ?? appleData.session?.user?.id
      const userEmail = appleData.user?.email ?? appleData.session?.user?.email
      if (userId) {
        await syncAppleProfileDisplayName(userId, {
          appleFullName: credential.fullName,
          email: userEmail,
        })

        const suspendedMsg = await getProfileSuspendedMessage(userId)
        if (suspendedMsg) {
          await supabase.auth.signOut()
          return { error: new Error(suspendedMsg) }
        }
      }

      return { error: null }
    } catch (e: unknown) {
      const code =
        typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : ''
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
        return { error: null }
      }
      const message = e instanceof Error ? e.message : 'Error en Sign in with Apple'
      return { error: new Error(message) }
    }
  },

  ensureSessionValid: async () => {
    const current = get().session
    if (!current) return

    const { expired } = await validateAuthSession(current)
    if (!expired) return

    await clearSessionBackgroundMarker()
    set({
      session: null,
      passwordRecoveryPending: false,
      pendingInviteHref: null,
      lastAuthMessage: SESSION_EXPIRED_MESSAGE,
    })
  },
}))

/** Hook de conveniencia (mismo store que `useAuthStore`). */
export const useAuth = useAuthStore
