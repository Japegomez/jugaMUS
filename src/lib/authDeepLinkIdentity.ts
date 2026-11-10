import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

/**
 * Reads `email` from a Supabase JWT access token without persisting a session.
 */
export function emailFromAccessToken(accessToken: string): string | null {
  try {
    const payloadPart = accessToken.split('.')[1]
    if (!payloadPart) return null

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
    const json = atob(base64 + pad)
    const payload = JSON.parse(json) as { email?: unknown }
    return typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : null
  } catch {
    return null
  }
}

/**
 * Exchanges a PKCE `code` on a disposable client (no persistence) so the UI can
 * show the account email before adopting the session on the main Supabase client.
 */
export async function peekSessionFromAuthCode(code: string): Promise<{
  email: string | null
  access_token: string | null
  refresh_token: string | null
  error: Error | null
}> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      },
    },
  })

  const { data, error } = await client.auth.exchangeCodeForSession(code)
  if (error) {
    return {
      email: null,
      access_token: null,
      refresh_token: null,
      error: new Error(error.message),
    }
  }

  const session = data.session
  return {
    email: session?.user?.email ?? null,
    access_token: session?.access_token ?? null,
    refresh_token: session?.refresh_token ?? null,
    error: null,
  }
}
