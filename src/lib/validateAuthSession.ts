import type { AuthError, Session } from '@supabase/supabase-js'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Inicia sesión de nuevo.'

function isTransientNetworkError(error: AuthError): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    isAuthRetryableFetchError(error) ||
    /network|fetch|offline|timeout|failed to fetch|network request failed|socket|econnreset|enotfound/i.test(
      msg
    )
  )
}

/**
 * `getSession()` only reads persisted storage and may return a stale JWT.
 * `getUser()` hits Auth and forces a refresh; on failure the local session must be cleared
 * (except transient network errors, so offline opens do not force login).
 */
export async function validateAuthSession(
  session: Session | null
): Promise<{ session: Session | null; expired: boolean }> {
  if (!session) return { session: null, expired: false }

  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) {
    return { session, expired: false }
  }

  if (error && isTransientNetworkError(error)) {
    return { session, expired: false }
  }

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* storage may already be inconsistent */
  }
  return { session: null, expired: true }
}
