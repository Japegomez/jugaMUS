import { MATCH_STATUS } from '@/constants'
import { posthog } from '@/lib/posthog'
import { supabase } from '@/lib/supabase'

export const AnalyticsEvents = {
  USER_SIGNED_UP: 'user_signed_up',
  MATCH_CREATED: 'match_created',
  MATCH_JOINED: 'match_joined',
  MATCH_COMPLETED: 'match_completed',
} as const

export type AuthSignupMethod = 'email' | 'google' | 'apple'

type AnalyticsProps = Record<string, string | number | boolean | null>

type AuthUserTimestamps = {
  created_at: string
  last_sign_in_at?: string | null
}

/** True when created_at and last_sign_in_at are within ~2 minutes (likely first session). */
export function isLikelyNewAuthUser(user: AuthUserTimestamps): boolean {
  const created = Date.parse(user.created_at)
  const last = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : created
  if (Number.isNaN(created) || Number.isNaN(last)) return false
  return Math.abs(last - created) < 120_000
}

export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!userId) return
  posthog.identify(userId, properties)
}

export function resetAnalytics(): void {
  posthog.reset()
}

export function captureEvent(event: string, properties?: AnalyticsProps): void {
  posthog.capture(event, properties)
}

export function trackUserSignedUp(method: AuthSignupMethod): void {
  captureEvent(AnalyticsEvents.USER_SIGNED_UP, { method })
}

export function trackMatchCreated(matchId: string, visibility: string): void {
  captureEvent(AnalyticsEvents.MATCH_CREATED, { match_id: matchId, visibility })
}

export function trackMatchJoined(matchId: string, team: string): void {
  captureEvent(AnalyticsEvents.MATCH_JOINED, { match_id: matchId, team })
}

export function trackMatchCompleted(matchId: string): void {
  captureEvent(AnalyticsEvents.MATCH_COMPLETED, { match_id: matchId })
}

/** After confirmation flows: only fire when the match is actually finished. */
export async function trackMatchCompletedIfFinished(matchId: string): Promise<void> {
  const { data, error } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .maybeSingle()

  if (error || !data) return
  if (data.status === MATCH_STATUS.FINISHED) {
    trackMatchCompleted(matchId)
  }
}
