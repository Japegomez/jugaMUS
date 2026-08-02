import { useCallback, useEffect, useState } from 'react'

import { usePostHog } from 'posthog-react-native'

import { AppRatingPrompt } from '@/components/AppRatingPrompt'
import { AppUpdatePrompt } from '@/components/AppUpdatePrompt'
import { useAuthStore } from '@/hooks/useAuth'
import { checkShouldShowRatingPrompt, markRatingPromptShown } from '@/lib/appRating'
import {
  AppUpdatePayload,
  checkShouldShowUpdatePrompt,
  openStoreListing,
  snoozeUpdate,
} from '@/lib/appUpdate'
import { requestAppStoreRating } from '@/lib/storeReview'

const PROMPT_DELAY_MS = 2500
const FLAG_KEY = 'app-update-prompt'

type ActivePrompt = 'update' | 'rating' | null

export function AppPromptsHost() {
  const posthog = usePostHog()
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const initialized = useAuthStore((s) => s.initialized)

  const [activePrompt, setActivePrompt] = useState<ActivePrompt>(null)
  const [updatePayload, setUpdatePayload] = useState<AppUpdatePayload | null>(null)

  useEffect(() => {
    if (!initialized || !sessionUserId) return

    let cancelled = false

    const timer = setTimeout(() => {
      void (async () => {
        // Refresh flags so we always use the latest remote config value.
        if (posthog) {
          try {
            await posthog.reloadFeatureFlagsAsync()
          } catch {
            // non-fatal — fall through with cached flags
          }
        }

        if (cancelled) return

        const rawPayload = posthog?.getFeatureFlagPayload(FLAG_KEY)
        const payload = await checkShouldShowUpdatePrompt(rawPayload)

        if (cancelled) return

        if (payload) {
          setUpdatePayload(payload)
          setActivePrompt('update')
          return
        }

        const shouldRate = await checkShouldShowRatingPrompt(sessionUserId)
        if (!cancelled && shouldRate) {
          setActivePrompt('rating')
        }
      })()
    }, PROMPT_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [initialized, sessionUserId, posthog])

  const dismissUpdate = useCallback(async () => {
    setActivePrompt(null)
    if (updatePayload) {
      await snoozeUpdate(updatePayload.latestVersion)
    }
  }, [updatePayload])

  const openUpdate = useCallback(async () => {
    setActivePrompt(null)
    if (updatePayload) {
      await snoozeUpdate(updatePayload.latestVersion)
    }
    await openStoreListing()
  }, [updatePayload])

  const dismissRating = useCallback(async () => {
    setActivePrompt(null)
    if (sessionUserId) await markRatingPromptShown(sessionUserId)
  }, [sessionUserId])

  const rate = useCallback(async () => {
    await requestAppStoreRating()
    await dismissRating()
  }, [dismissRating])

  const isReady = initialized && !!sessionUserId

  return (
    <>
      <AppUpdatePrompt
        visible={activePrompt === 'update' && isReady}
        title={updatePayload?.title}
        message={updatePayload?.message}
        onUpdate={() => void openUpdate()}
        onDismiss={() => void dismissUpdate()}
      />
      <AppRatingPrompt
        visible={activePrompt === 'rating' && isReady}
        onRate={() => void rate()}
        onDismiss={() => void dismissRating()}
      />
    </>
  )
}
