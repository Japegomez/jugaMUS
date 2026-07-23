import { useEffect } from 'react'
import { AppState } from 'react-native'

import { useAuthStore } from '@/hooks/useAuth'
import {
  clearSessionBackgroundMarker,
  isSessionExpiredAfterBackground,
  markSessionBackgrounded,
} from '@/lib/sessionBackground'
import { SESSION_EXPIRED_MESSAGE } from '@/lib/validateAuthSession'

/**
 * Signs the user out if:
 * - the app stayed in background longer than the configured timeout, or
 * - the persisted Auth session is no longer valid (refresh/JWT expired).
 *
 * Only runs on AppState transition to `active` (after background/inactive),
 * not on every session reference change (e.g. token refresh).
 */
export function useBackgroundSessionTimeout() {
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized) return

    const expireIfNeeded = async () => {
      const store = useAuthStore.getState()
      if (!store.session) return

      const expired = await isSessionExpiredAfterBackground()
      await clearSessionBackgroundMarker()

      if (expired) {
        await store.signOut()
        useAuthStore.setState({ lastAuthMessage: SESSION_EXPIRED_MESSAGE })
        return
      }

      // Read from getState() so Fast Refresh / HMR cannot call a stale undefined selector.
      const ensure = useAuthStore.getState().ensureSessionValid
      if (typeof ensure === 'function') {
        await ensure()
      }
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (useAuthStore.getState().session) {
          void markSessionBackgrounded()
        }
        return
      }

      if (nextState === 'active') {
        void expireIfNeeded()
      }
    })

    return () => subscription.remove()
  }, [initialized])
}
