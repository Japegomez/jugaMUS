import { useEffect } from 'react'
import { AppState } from 'react-native'

import { useAuthStore } from '@/hooks/useAuth'
import {
  clearSessionBackgroundMarker,
  isSessionExpiredAfterBackground,
  markSessionBackgrounded,
} from '@/lib/sessionBackground'

/**
 * Signs the user out if the app stayed in background longer than the configured timeout.
 */
export function useBackgroundSessionTimeout() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const signOut = useAuthStore((s) => s.signOut)

  useEffect(() => {
    if (!initialized) return

    const expireIfNeeded = async () => {
      if (!useAuthStore.getState().session) return

      const expired = await isSessionExpiredAfterBackground()
      await clearSessionBackgroundMarker()

      if (expired) {
        await signOut()
      }
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
  }, [initialized, session, signOut])
}
