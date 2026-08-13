import { useCallback, useRef, useState } from 'react'

import { CAPTCHA_REQUIRED_MESSAGE, isTurnstileEnabled } from '@/lib/turnstile'

export type CaptchaSolveResult = {
  token?: string
  error: string | null
  cancelled?: boolean
}

export function useTurnstileCaptcha() {
  const enabled = isTurnstileEnabled()
  const [visible, setVisible] = useState(false)
  const [resetNonce, setResetNonce] = useState(0)
  const pendingRef = useRef<((result: CaptchaSolveResult) => void) | null>(null)

  const finish = useCallback((result: CaptchaSolveResult) => {
    const resolve = pendingRef.current
    pendingRef.current = null
    setVisible(false)
    resolve?.(result)
  }, [])

  const solve = useCallback((): Promise<CaptchaSolveResult> => {
    if (!enabled) return Promise.resolve({ error: null })
    if (pendingRef.current) {
      return Promise.resolve({ error: null, cancelled: true })
    }
    setResetNonce((n) => n + 1)
    setVisible(true)
    return new Promise((resolve) => {
      pendingRef.current = resolve
    })
  }, [enabled])

  const complete = useCallback(
    (token: string) => {
      finish({ token, error: null })
    },
    [finish]
  )

  const fail = useCallback(
    (message: string = CAPTCHA_REQUIRED_MESSAGE) => {
      finish({ error: message })
    },
    [finish]
  )

  const cancel = useCallback(() => {
    finish({ error: null, cancelled: true })
  }, [finish])

  return { enabled, visible, resetNonce, solve, complete, fail, cancel }
}
