import type * as AppleAuthentication from 'expo-apple-authentication'

import { supabase } from '@/lib/supabase'

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

/** Applies Apple full name or fixes relay-email placeholder display names. */
export async function syncAppleProfileDisplayName(
  userId: string,
  options: {
    appleFullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined
    email: string | null | undefined
  }
): Promise<void> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) return

  const nextName = resolveAppleProfileDisplayName({
    appleFullName: options.appleFullName,
    email: options.email,
    currentDisplayName: profile.display_name,
  })

  if (!nextName || nextName === profile.display_name) return

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: nextName })
    .eq('id', userId)

  if (profileError) {
    console.warn('[syncAppleProfileDisplayName] profile update failed:', profileError.message)
    return
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { display_name: nextName, full_name: nextName },
  })

  if (authError) {
    console.warn('[syncAppleProfileDisplayName] auth metadata update failed:', authError.message)
  }
}
