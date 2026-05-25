/** Nombre comercial mostrado en la UI. */
export const APP_DISPLAY_NAME = 'jugaMUS'

/** Deep link scheme (debe coincidir con `scheme` en app.json y Redirect URLs en Supabase). */
export const APP_SCHEME = 'jugamus'

export const APP_OAUTH_CALLBACK_PATH = 'auth/callback'

export function appDeepLink(path: string): string {
  return `${APP_SCHEME}://${path}`
}
