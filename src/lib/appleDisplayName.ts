import type * as AppleAuthentication from 'expo-apple-authentication'

export const DEFAULT_APPLE_FALLBACK_DISPLAY_NAME = 'Usuario'

const APPLE_RELAY_EMAIL_SUFFIX = '@privaterelay.appleid.com'

export function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined
): string | null {
  if (!fullName) return null

  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)

  const name = parts.join(' ').trim()
  return name.length >= 2 ? name : null
}

export function isAppleRelayEmail(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith(APPLE_RELAY_EMAIL_SUFFIX)
}

export function isRelayDerivedDisplayName(
  email: string | null | undefined,
  displayName: string
): boolean {
  if (!email || !isAppleRelayEmail(email)) return false
  const localPart = email.split('@')[0]?.trim() ?? ''
  return localPart.length > 0 && displayName.trim() === localPart
}

export function resolveAppleProfileDisplayName(params: {
  appleFullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined
  email: string | null | undefined
  currentDisplayName: string
}): string | null {
  const appleName = formatAppleFullName(params.appleFullName)
  if (appleName) return appleName

  if (isRelayDerivedDisplayName(params.email, params.currentDisplayName)) {
    return DEFAULT_APPLE_FALLBACK_DISPLAY_NAME
  }

  return null
}
