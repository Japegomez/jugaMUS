import type { User } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { resolveOAuthAvatarUrlFromUser } from '@/lib/oauthAvatar'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { uploadAvatar } from '@/services/profiles.service'

const inFlight = new Set<string>()

/**
 * If the profile has no photo yet and OAuth metadata includes an avatar,
 * download it and upload to the avatars bucket (whitelist-compliant photo_url).
 */
export async function syncOAuthProfilePhoto(user: User): Promise<boolean> {
  if (inFlight.has(user.id)) return false
  inFlight.add(user.id)

  try {
    const remoteUrl = resolveOAuthAvatarUrlFromUser(user)
    if (!remoteUrl) return false

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('photo_url')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !profile) return false
    if (profile.photo_url?.trim()) return false

    const localUri = await downloadOAuthAvatar(remoteUrl, user.id)
    if (!localUri) return false

    try {
      await uploadAvatar(user.id, localUri, 'image/jpeg')
      void queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      return true
    } finally {
      if (Platform.OS !== 'web' && localUri.startsWith('file:')) {
        void FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined)
      }
    }
  } catch (err) {
    console.warn(
      '[syncOAuthProfilePhoto] failed:',
      err instanceof Error ? err.message : String(err)
    )
    return false
  } finally {
    inFlight.delete(user.id)
  }
}

async function downloadOAuthAvatar(remoteUrl: string, userId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    // ImageManipulator accepts remote https URLs on web.
    return remoteUrl
  }

  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) return remoteUrl

  const dest = `${cacheDir}oauth-avatar-${userId}.jpg`
  const result = await FileSystem.downloadAsync(remoteUrl, dest)
  if (result.status !== 200) {
    console.warn('[syncOAuthProfilePhoto] download status', result.status)
    return null
  }
  return result.uri
}
