import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

import { APP_SCHEME } from '@/constants/app'
import { completeOAuthSessionFromCallbackUrl } from '@/lib/completeOAuthSession'
import { getOAuthRedirectUrl } from '@/lib/authRedirect'
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

export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<{ error: Error | null }> {
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

    return await completeOAuthSessionFromCallbackUrl(callbackUrl)
  } finally {
    sub.remove()
  }
}
