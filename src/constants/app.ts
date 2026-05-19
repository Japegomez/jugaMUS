/** Nombre comercial mostrado en la UI. */
export const APP_DISPLAY_NAME = 'Mussa Suerte'

/** Deep link scheme (debe coincidir con `scheme` en app.json y Redirect URLs en Supabase). */
export const APP_SCHEME = 'mussasuerte'

export const APP_OAUTH_CALLBACK_PATH = 'auth/callback'

export function appDeepLink(path: string): string {
  return `${APP_SCHEME}://${path}`
}
