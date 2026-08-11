import type { Href } from 'expo-router'

/** Normalize expo-router search param values. */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** Only allow in-app tab routes as return targets. */
export function isSafeTabsHref(href: string): href is string {
  return href.startsWith('/(tabs)/') && !href.includes('://') && !href.includes('..')
}

export function buildMatchDetailHref(
  matchId: string,
  opts?: { from?: string; profileUserId?: string }
): Href {
  const params = new URLSearchParams()
  if (opts?.from) params.set('from', opts.from)
  if (opts?.profileUserId) params.set('profileUserId', opts.profileUserId)
  const qs = params.toString()
  return (qs ? `/(tabs)/matches/${matchId}?${qs}` : `/(tabs)/matches/${matchId}`) as Href
}

export function buildProfileHref(profileUserId?: string | null): Href {
  if (profileUserId) return `/(tabs)/profile/${profileUserId}` as Href
  return '/(tabs)/profile' as Href
}
