import type { User } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { resolveOAuthAvatarUrlFromUser } from '@/lib/oauthAvatar'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { uploadAvatar } from '@/services/profiles.service'

const inFlight = new Set<string>()

const ALLOWED_DOWNLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type DownloadedAvatar = {
  uri: string
  /** Validated MIME, or null when the header is absent (caller may still try). */
  mimeType: string | null
}

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

    const downloaded = await downloadOAuthAvatar(remoteUrl, user.id)
    if (!downloaded) return false

    try {
      const photoUrl = await uploadAvatar(user.id, downloaded.uri, downloaded.mimeType, {
        onlyIfEmpty: true,
      })
      if (!photoUrl) {
        // Another writer filled photo_url after our empty check (TOCTOU).
        return false
      }
      void queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      return true
    } finally {
      if (Platform.OS !== 'web' && downloaded.uri.startsWith('file:')) {
        void FileSystem.deleteAsync(downloaded.uri, { idempotent: true }).catch(() => undefined)
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

/** Parse Content-Type; reject disallowed types; null = header missing (safe to proceed). */
function parseAvatarContentType(raw: string | null | undefined): string | null | 'invalid' {
  if (raw == null || !String(raw).trim()) return null
  const base = String(raw).split(';')[0]?.trim().toLowerCase() ?? ''
  if (!base) return null
  if (!ALLOWED_DOWNLOAD_MIME_TYPES.has(base)) return 'invalid'
  return base
}

function contentTypeFromHeaders(
  headers: Record<string, string> | undefined
): string | null | 'invalid' {
  if (!headers) return null
  const raw =
    headers['Content-Type'] ??
    headers['content-type'] ??
    headers['CONTENT-TYPE'] ??
    Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1]
  return parseAvatarContentType(raw)
}

async function downloadOAuthAvatar(
  remoteUrl: string,
  userId: string
): Promise<DownloadedAvatar | null> {
  if (Platform.OS === 'web') {
    try {
      const head = await fetch(remoteUrl, { method: 'HEAD' })
      const mime = parseAvatarContentType(head.headers.get('content-type'))
      if (mime === 'invalid') {
        console.warn('[syncOAuthProfilePhoto] rejected content-type on web')
        return null
      }
      return { uri: remoteUrl, mimeType: mime }
    } catch {
      // Missing/unreachable headers: allow ImageManipulator to try the remote URL.
      return { uri: remoteUrl, mimeType: null }
    }
  }

  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    return { uri: remoteUrl, mimeType: null }
  }

  const dest = `${cacheDir}oauth-avatar-${userId}.jpg`
  const result = await FileSystem.downloadAsync(remoteUrl, dest)
  if (result.status !== 200) {
    console.warn('[syncOAuthProfilePhoto] download status', result.status)
    return null
  }

  const mime = contentTypeFromHeaders(result.headers)
  if (mime === 'invalid') {
    console.warn('[syncOAuthProfilePhoto] rejected content-type', result.headers)
    void FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined)
    return null
  }

  return { uri: result.uri, mimeType: mime }
}
