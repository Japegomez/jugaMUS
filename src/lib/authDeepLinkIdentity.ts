import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

/**
 * Resolves the account email for an implicit-flow access token by asking the auth
 * server to validate the token; the JWT payload is never trusted on its own.
 */
export async function verifiedEmailFromAccessToken(
  accessToken: string
): Promise<string | null> {
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

  const { data, error } = await client.auth.getUser(accessToken)
  if (error) return null
  return data.user?.email ?? null
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
