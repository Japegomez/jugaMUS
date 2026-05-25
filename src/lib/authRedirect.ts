import * as Linking from 'expo-linking'

import { APP_OAUTH_CALLBACK_PATH, APP_SCHEME } from '@/constants/app'

/**
 * URL de retorno OAuth (debe coincidir con "Redirect URLs" en Supabase Auth).
 *
 * Expo Go (iPhone/Android): genera `exp://192.168.x.x:PORT/--/auth/callback`
 * Build standalone:          genera `jugamus://auth/callback`
 *
 * En Supabase → Auth → URL Configuration → Redirect URLs añade:
 *   exp://**                         (wildcard para Expo Go)
 *   jugamus://auth/callback          (para builds de producción/desarrollo nativo)
 */
export function getOAuthRedirectUrl(): string {
  return Linking.createURL(APP_OAUTH_CALLBACK_PATH)
}

/** Ejemplo de redirect nativa (documentación / mensajes de error). */
export const NATIVE_OAUTH_REDIRECT_EXAMPLE = `${APP_SCHEME}://${APP_OAUTH_CALLBACK_PATH}`
