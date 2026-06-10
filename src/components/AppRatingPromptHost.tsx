import * as StoreReview from 'expo-store-review'
import { useCallback, useEffect, useState } from 'react'

import { AppRatingPrompt } from '@/components/AppRatingPrompt'
import { useAuthStore } from '@/hooks/useAuth'
import { checkShouldShowRatingPrompt, markRatingPromptShown } from '@/lib/appRating'

const PROMPT_DELAY_MS = 2500

export function AppRatingPromptHost() {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)
  const initialized = useAuthStore((s) => s.initialized)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!initialized || !sessionUserId) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const shouldShow = await checkShouldShowRatingPrompt(sessionUserId)
        if (!cancelled && shouldShow) setVisible(true)
      })()
    }, PROMPT_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [initialized, sessionUserId])

  const dismiss = useCallback(async () => {
    setVisible(false)
    if (sessionUserId) await markRatingPromptShown(sessionUserId)
  }, [sessionUserId])

  const rate = useCallback(async () => {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview()
    }
    await dismiss()
  }, [dismiss])

  const showPrompt = visible && initialized && !!sessionUserId

  return (
    <AppRatingPrompt
      visible={showPrompt}
      onRate={() => void rate()}
      onDismiss={() => void dismiss()}
    />
  )
}
