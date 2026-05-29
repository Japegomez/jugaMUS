import { getAuthStorage } from '@/lib/authStorage'

const SESSION_BACKGROUNDED_AT_KEY = 'jugamus.session_backgrounded_at'

/** Sign out when the app returns from background after at least this long. */
export const BACKGROUND_SESSION_TIMEOUT_MS = 10 * 60 * 1000

export async function markSessionBackgrounded(): Promise<void> {
  await getAuthStorage().setItem(SESSION_BACKGROUNDED_AT_KEY, String(Date.now()))
}

export async function clearSessionBackgroundMarker(): Promise<void> {
  await getAuthStorage().removeItem(SESSION_BACKGROUNDED_AT_KEY)
}

export async function isSessionExpiredAfterBackground(): Promise<boolean> {
  const raw = await getAuthStorage().getItem(SESSION_BACKGROUNDED_AT_KEY)
  if (!raw) return false

  const backgroundedAt = Number(raw)
  if (!Number.isFinite(backgroundedAt)) {
    await clearSessionBackgroundMarker()
    return false
  }

  return Date.now() - backgroundedAt >= BACKGROUND_SESSION_TIMEOUT_MS
}
