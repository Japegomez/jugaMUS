import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

import { APP_SCHEME } from '@/constants/app'
import { completeOAuthSessionFromCallbackUrl } from '@/lib/completeOAuthSession'
import { getOAuthRedirectUrl, NATIVE_OAUTH_REDIRECT_EXAMPLE } from '@/lib/authRedirect'
import { supabase } from '@/lib/supabase'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple'

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

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

/** El navegador no envía headers; Kong exige `apikey` en la query de /authorize. */
function withAuthorizeApiKey(authorizeUrl: string): string {
  if (!supabaseAnonKey) return authorizeUrl
  try {
    const url = new URL(authorizeUrl)
    if (!url.searchParams.has('apikey')) {
      url.searchParams.set('apikey', supabaseAnonKey)
    }
    return url.toString()
  } catch {
    return authorizeUrl
  }
}

function mapOAuthErrorMessage(message: string, redirectTo: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('no api key') || lower.includes('apikey')) {
    return (
      'El retorno OAuth falló (Supabase mostró “No API key found”). ' +
      'En Expo Go esto es habitual: el deep link exp:// no cierra bien el flujo. ' +
      'Usa email/contraseña, o un development build / la app de producción con ' +
      `${NATIVE_OAUTH_REDIRECT_EXAMPLE}. Redirect intentado: ${redirectTo}`
    )
  }
  return message
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<{ error: Error | null }> {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || !supabaseAnonKey) {
    return {
      error: new Error(
        'Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local y reinicia con `npx expo start -c`.'
      ),
    }
  }

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
    return { error: new Error(mapOAuthErrorMessage(oauthError.message, redirectTo)) }
  }

  const rawUrl = data.url
  if (!rawUrl) {
    return { error: new Error('No se obtuvo URL de OAuth') }
  }

  const url = withAuthorizeApiKey(rawUrl)

  // Debe ser la URL completa (no solo `exp://` / `jugamus://`): ASWebAuthenticationSession
  // / Chrome Custom Tabs cierran la sesión al ver ese redirect. Con solo el scheme, en
  // Expo Go el retorno a menudo falla y Supabase cae al Site URL → "No API key found".
  const returnUrl = redirectTo

  let capturedUrl: string | null = null
  const sub = Linking.addEventListener('url', ({ url: incoming }) => {
    if (isOAuthReturnUrl(incoming)) {
      capturedUrl = incoming
    }
  })

  try {
    if (__DEV__) {
      console.log('[oauth] provider=', provider, 'redirectTo=', redirectTo)
    }

    const result = await WebBrowser.openAuthSessionAsync(url, returnUrl)

    let callbackUrl: string | null =
      result.type === 'success' && result.url ? result.url : capturedUrl

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
          `No se recibió la URL de retorno del navegador. En Supabase → Auth → URL, añade la redirect exacta que usa la app (p. ej. ${APP_SCHEME}://auth/callback o la exp://… de Expo Go, o el wildcard exp://**) y reintenta. Redirect actual: ${redirectTo}`
        ),
      }
    }

    const completed = await completeOAuthSessionFromCallbackUrl(callbackUrl)
    if (completed.error) {
      return {
        error: new Error(mapOAuthErrorMessage(completed.error.message, redirectTo)),
      }
    }
    return completed
  } finally {
    sub.remove()
  }
}
