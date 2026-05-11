import * as Linking from 'expo-linking'

/**
 * URL de retorno OAuth (debe coincidir con "Redirect URLs" en Supabase Auth).
 *
 * Expo Go (iPhone/Android): genera `exp://192.168.x.x:PORT/--/auth/callback`
 * Build standalone:          genera `musapp://auth/callback`
 *
 * En Supabase → Auth → URL Configuration → Redirect URLs añade:
 *   exp://**                  (wildcard para Expo Go)
 *   musapp://auth/callback    (para builds de producción/desarrollo nativo)
 */
export function getOAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback')
}
