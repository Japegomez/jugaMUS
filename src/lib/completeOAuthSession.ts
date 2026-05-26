import * as QueryParams from 'expo-auth-session/build/QueryParams'

import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl'
import { supabase } from '@/lib/supabase'

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

/** Wait for oauth.ts (WebBrowser flow) to finish exchanging the PKCE code. */
export async function waitForAuthSession(timeoutMs = 4500, intervalMs = 200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

export async function completeOAuthSessionFromCallbackUrl(
  callbackUrl: string
): Promise<{ error: Error | null }> {
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
