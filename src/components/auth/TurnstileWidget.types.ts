export interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void
  onError?: (message: string) => void
  /** Increment to remount and mint a fresh challenge after each auth attempt. */
  resetNonce?: number
}
