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
 */
export function useBackgroundSessionTimeout() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const signOut = useAuthStore((s) => s.signOut)
  const ensureSessionValid = useAuthStore((s) => s.ensureSessionValid)

  useEffect(() => {
    if (!initialized) return

    const expireIfNeeded = async () => {
      if (!useAuthStore.getState().session) return

      const expired = await isSessionExpiredAfterBackground()
      await clearSessionBackgroundMarker()

      if (expired) {
        await signOut()
        useAuthStore.setState({ lastAuthMessage: SESSION_EXPIRED_MESSAGE })
        return
      }

      await ensureSessionValid()
    }

    if (session) {
      void expireIfNeeded()
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
  }, [initialized, session, signOut, ensureSessionValid])
}
