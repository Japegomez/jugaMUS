/**
 * OAuth providers (Google) expose avatar_url / picture in user_metadata.
 * Profiles only accept photo_url from the project avatars bucket, so these
 * remote URLs must be downloaded and re-uploaded — never stored directly.
 */

const ALLOWED_AVATAR_HOST_SUFFIXES = [
  '.googleusercontent.com',
  '.ggpht.com',
  '.google.com',
] as const

const ALLOWED_AVATAR_HOSTS = new Set([
  'googleusercontent.com',
  'ggpht.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
])

function isAllowedOAuthAvatarHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (ALLOWED_AVATAR_HOSTS.has(host)) return true
  return ALLOWED_AVATAR_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** Returns a safe https avatar URL from OAuth metadata, or null. */
export function resolveOAuthAvatarUrl(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null

  const candidates = [metadata.avatar_url, metadata.picture, metadata.photo_url]
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    try {
      const url = new URL(trimmed)
      if (url.protocol !== 'https:') continue
      if (!isAllowedOAuthAvatarHost(url.hostname)) continue
      return url.toString()
    } catch {
      continue
    }
  }
  return null
}

/** Prefer identity_data from Google when present, else user_metadata. */
export function resolveOAuthAvatarUrlFromUser(user: {
  user_metadata?: Record<string, unknown> | null
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> | null }> | null
}): string | null {
  const googleIdentity = user.identities?.find((i) => i.provider === 'google')
  return (
    resolveOAuthAvatarUrl(googleIdentity?.identity_data) ??
    resolveOAuthAvatarUrl(user.user_metadata)
  )
}
