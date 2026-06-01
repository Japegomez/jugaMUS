import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'

import { getOAuthRedirectUrl } from '@/lib/authRedirect'
import { signInWithOAuthProvider } from '@/lib/oauth'
import { clearSessionBackgroundMarker } from '@/lib/sessionBackground'
import { supabase } from '@/lib/supabase'

let authSubscription: { unsubscribe: () => void } | null = null

/** Supabase Auth devuelve 429 si hay demasiados signUp / emails / login desde la misma IP. */
function userFacingAuthError(error: { message: string; status?: number }): Error {
  const msg = error.message ?? ''
  const st = typeof error.status === 'number' ? error.status : undefined
  if (/invalid login credentials|invalid_credentials/i.test(msg)) {
    return new Error('Email o contraseña incorrectos')
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
  lastAuthMessage: string | null
  setSession: (session: Session | null) => void
  setInitialized: (initialized: boolean) => void
  clearLastAuthMessage: () => void
  initializeAuth: () => void
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithApple: () => Promise<{ error: Error | null }>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  lastAuthMessage: null,

  setSession: (session) => set({ session }),
  setInitialized: (initialized) => set({ initialized }),
  clearLastAuthMessage: () => set({ lastAuthMessage: null }),

  initializeAuth: () => {
    if (authSubscription) return

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const suspendedMsg = await getProfileSuspendedMessage(session.user.id)
        if (suspendedMsg) {
          await supabase.auth.signOut()
          set({ session: null, initialized: true, lastAuthMessage: suspendedMsg })
          return
        }
      }
      set({ session, initialized: true })
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Set session in the store immediately so root navigation does not treat the user as
      // logged out while we await the profile check (fixes OAuth returning to login).
      set({ session })
      if (!get().initialized) {
        set({ initialized: true })
      }

      if (event === 'SIGNED_IN') {
        void clearSessionBackgroundMarker()
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        void (async () => {
          const suspendedMsg = await getProfileSuspendedMessage(session.user.id)
          if (suspendedMsg) {
            await supabase.auth.signOut()
            set({ session: null, lastAuthMessage: suspendedMsg })
          }
        })()
      }
    })

    authSubscription = data.subscription
  },

  signInWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: userFacingAuthError(error) }
    }
    if (data.user) {
      const suspendedMsg = await getProfileSuspendedMessage(data.user.id)
      if (suspendedMsg) {
        await supabase.auth.signOut()
        return { error: new Error(suspendedMsg) }
      }
    }
    return { error: null }
  },

  signUp: async ({ email, password, displayName }) => {
    const { error } = await supabase.auth.signUp({
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
    return { error: null }
  },

  signOut: async () => {
    await clearSessionBackgroundMarker()
    await supabase.auth.signOut()
    set({ session: null })
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
    set({ session: null })
    return { error: null }
  },

  resetPassword: async (email) => {
    const redirectTo = getOAuthRedirectUrl()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      return { error: userFacingAuthError(error) }
    }
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
      if (userId) {
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
}))

/** Hook de conveniencia (mismo store que `useAuthStore`). */
export const useAuth = useAuthStore
