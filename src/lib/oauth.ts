import * as QueryParams from 'expo-auth-session/build/QueryParams'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

import { APP_SCHEME } from '@/constants/app'
import { getOAuthRedirectUrl } from '@/lib/authRedirect'
import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl'
import { supabase } from '@/lib/supabase'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple'

function isOAuthReturnUrl(url: string): boolean {
  const lower = url.toLowerCase()
  const schemeOk =
    lower.startsWith(`${APP_SCHEME}://`) ||
    (__DEV__ && (lower.startsWith('exp://') || lower.startsWith('exps://')))
  if (!schemeOk) return false
  return (
    lower.includes('auth/callback') ||
    lower.includes('/--/auth/callback') ||
    lower.includes('code=') ||
    lower.includes('access_token=') ||
    lower.includes('error=')
  )
}

function getQueryParamsFromCallbackUrl(url: string): {
  params: Record<string, string>
  errorCode: string | null
} {
  try {
    return QueryParams.getQueryParams(url)
  } catch {
    const parsed = parseAuthCallbackUrl(url)
    const params: Record<string, string> = {}
    if (parsed.code) params.code = parsed.code
    if (parsed.access_token) params.access_token = parsed.access_token
    if (parsed.refresh_token) params.refresh_token = parsed.refresh_token
    return { params, errorCode: null }
  }
}

async function createSessionFromCallbackUrl(callbackUrl: string): Promise<{ error: Error | null }> {
  const { params, errorCode } = getQueryParamsFromCallbackUrl(callbackUrl)

  if (errorCode) {
    return { error: new Error(String(errorCode)) }
  }

  const oauthErr = params.error ?? params.error_description
  if (oauthErr) {
    return { error: new Error(String(oauthErr)) }
  }

  const code = params.code
  const access_token = params.access_token
  const refresh_token = params.refresh_token

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return { error: new Error(error.message) }
    }
    return { error: null }
  }

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (error) {
      return { error: new Error(error.message) }
    }
    return { error: null }
  }

  return { error: new Error('La URL de retorno no incluye sesión ni código de autorización') }
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<{ error: Error | null }> {
  // En web hacemos redirect de página completa: el flujo de popup falla por
  // las cabeceras COOP de Google (bloquean window.closed desde el padre).
  // detectSessionInUrl en supabase.ts se encarga de canjear el code al volver.
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + '/',
      },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const redirectTo = getOAuthRedirectUrl()

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (oauthError) {
    return { error: new Error(oauthError.message) }
  }

  const url = data.url
  if (!url) {
    return { error: new Error('No se obtuvo URL de OAuth') }
  }

  // ASWebAuthenticationSession (iOS) detecta el cierre por el *prefijo* del scheme,
  // no por la URL completa. Usar solo el scheme evita fallos de matching cuando la
  // redirectTo lleva IP dinámica (Expo Go) o parámetros adicionales.
  const redirectScheme = redirectTo.split('://')[0] + '://'

  let capturedUrl: string | null = null
  const sub = Linking.addEventListener('url', ({ url: incoming }) => {
    if (isOAuthReturnUrl(incoming)) {
      capturedUrl = incoming
    }
  })

  try {
    const result = await WebBrowser.openAuthSessionAsync(url, redirectScheme)

    let callbackUrl: string | null =
      result.type === 'success' && result.url ? result.url : capturedUrl

    // iOS suele devolver `dismiss` aunque el login haya ido bien; el deep link llega un instante después.
    if (!callbackUrl && result.type === 'dismiss') {
      await new Promise((r) => setTimeout(r, 1500))
      callbackUrl = capturedUrl
    }

    if (!callbackUrl) {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: null }
      }
      return {
        error: new Error(
          `No se recibió la URL de retorno del navegador. En Supabase → Auth → URL, añade la redirect exacta que usa la app (p. ej. ${APP_SCHEME}://auth/callback o la exp://… de Expo Go) y reintenta.`
        ),
      }
    }

    return await createSessionFromCallbackUrl(callbackUrl)
  } finally {
    sub.remove()
  }
}
