import { MATCH_STATUS } from '@/constants'
import { getAuthStorage } from '@/lib/authStorage'
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

const MATCH_COMPLETED_IDS_KEY = 'analytics:match_completed_ids'
const MATCH_COMPLETED_IDS_MAX = 500

/** In-memory guards so concurrent calls on the same device do not double-emit. */
const matchCompletedEmitted = new Set<string>()
const matchCompletedInFlight = new Set<string>()

/** True when created_at and last_sign_in_at are within ~2 minutes (likely first session). */
export function isLikelyNewAuthUser(user: AuthUserTimestamps): boolean {
  if (user.last_sign_in_at == null) return false
  const created = Date.parse(user.created_at)
  const last = Date.parse(user.last_sign_in_at)
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

async function loadCompletedMatchIds(): Promise<string[]> {
  try {
    const raw = await getAuthStorage().getItem(MATCH_COMPLETED_IDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function persistCompletedMatchIds(ids: string[]): Promise<void> {
  const trimmed = ids.length > MATCH_COMPLETED_IDS_MAX ? ids.slice(-MATCH_COMPLETED_IDS_MAX) : ids
  try {
    await getAuthStorage().setItem(MATCH_COMPLETED_IDS_KEY, JSON.stringify(trimmed))
  } catch {
    /* storage quota / private mode — in-memory guard still applies this session */
  }
}

/**
 * Claims a one-shot emission for match_completed (persistent + in-memory).
 * Returns true only for the first successful claim for this matchId.
 */
async function claimMatchCompletedEmission(matchId: string): Promise<boolean> {
  if (matchCompletedEmitted.has(matchId) || matchCompletedInFlight.has(matchId)) {
    return false
  }
  matchCompletedInFlight.add(matchId)
  try {
    const ids = await loadCompletedMatchIds()
    if (ids.includes(matchId)) {
      matchCompletedEmitted.add(matchId)
      return false
    }
    ids.push(matchId)
    await persistCompletedMatchIds(ids)
    matchCompletedEmitted.add(matchId)
    return true
  } finally {
    matchCompletedInFlight.delete(matchId)
  }
}

/** Emit match_completed at most once per match (direct / referee / confirmation paths). */
export async function trackMatchCompletedOnce(matchId: string): Promise<void> {
  const claimed = await claimMatchCompletedEmission(matchId)
  if (!claimed) return
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
    await trackMatchCompletedOnce(matchId)
  }
}

/** Clears in-memory match_completed guards (tests only). */
export function __resetAnalyticsGuardsForTests(): void {
  matchCompletedEmitted.clear()
  matchCompletedInFlight.clear()
}
