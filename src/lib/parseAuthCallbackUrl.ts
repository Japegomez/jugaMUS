import { APP_SCHEME } from '@/constants/app'

const ALLOWED_SCHEMES = new Set([APP_SCHEME])

function isAllowedCallbackScheme(url: string): boolean {
  const lower = url.toLowerCase()
  if (ALLOWED_SCHEMES.has(APP_SCHEME) && lower.startsWith(`${APP_SCHEME}://`)) {
    return true
  }
  if (__DEV__ && (lower.startsWith('exp://') || lower.startsWith('exps://'))) {
    return true
  }
  return false
}

/**
 * Parses access/refresh tokens or PKCE `code` from the URL returned by the OAuth browser session.
 */
export function parseAuthCallbackUrl(url: string): {
  access_token: string | null
  refresh_token: string | null
  code: string | null
} {
  if (!isAllowedCallbackScheme(url)) {
    return { access_token: null, refresh_token: null, code: null }
  }

  let access_token: string | null = null
  let refresh_token: string | null = null
  let code: string | null = null

  const hashIdx = url.indexOf('#')
  if (hashIdx >= 0) {
    const hashParams = new URLSearchParams(url.slice(hashIdx + 1))
    access_token = hashParams.get('access_token')
    refresh_token = hashParams.get('refresh_token')
    code = hashParams.get('code')
  }

  const queryIdx = url.indexOf('?')
  if (queryIdx >= 0) {
    const beforeHash = url.split('#')[0] ?? url
    const q = beforeHash.slice(queryIdx + 1)
    const searchParams = new URLSearchParams(q)
    code ??= searchParams.get('code')
    access_token ??= searchParams.get('access_token')
    refresh_token ??= searchParams.get('refresh_token')
  }

  return { access_token, refresh_token, code }
}
