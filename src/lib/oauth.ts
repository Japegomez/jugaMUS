import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'
import { getOAuthRedirectUrl } from '@/lib/authRedirect'
import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google'

export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<{ error: Error | null }> {
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

  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo)

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { error: null }
  }

  if (result.type !== 'success' || !result.url) {
    return { error: new Error('Inicio de sesión cancelado o incompleto') }
  }

  const { access_token, refresh_token, code } = parseAuthCallbackUrl(result.url)

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return { error: new Error(exchangeError.message) }
    }
    return { error: null }
  }

  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (sessionError) {
      return { error: new Error(sessionError.message) }
    }
    return { error: null }
  }

  return { error: new Error('No se encontraron tokens en la URL de retorno') }
}
