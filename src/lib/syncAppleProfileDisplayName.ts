import type * as AppleAuthentication from 'expo-apple-authentication'

import { resolveAppleProfileDisplayName } from '@/lib/appleDisplayName'
import { supabase } from '@/lib/supabase'

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
