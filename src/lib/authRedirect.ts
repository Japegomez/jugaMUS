import { makeRedirectUri } from 'expo-auth-session'

/**
 * Redirect URI for Supabase OAuth (must match allowed URLs in Supabase + provider consoles).
 * Uses the `musapp` scheme from app.json.
 */
export function getOAuthRedirectUrl(): string {
  return makeRedirectUri({
    scheme: 'musapp',
    path: 'auth/callback',
  })
}
