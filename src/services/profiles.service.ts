import * as ImageManipulator from 'expo-image-manipulator'

import { supabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/database.types'

export type ProfileRow = {
  id: string
  display_name: string
  phone_e164: string
  photo_url: string | null
  city: string | null
  role: string
  status: string
  badge_showcase: string[]
  notify_push: boolean
  notify_on_join: boolean
  notify_on_match_start: boolean
  notify_on_match_edit: boolean
  notify_on_match_cancel: boolean
  notify_on_result: boolean
  notify_on_reminder_24h: boolean
  notify_on_reminder_2h: boolean
  notify_on_reminder_in_progress: boolean
  notify_on_friend_request: boolean
  notify_on_match_invitation: boolean
  created_at: string
  updated_at: string
}

export type OtherUserProfileRow = {
  id: string
  display_name: string
  photo_url: string | null
  city: string | null
  badge_showcase: string[]
  role: string
  status: string
  created_at: string
  updated_at: string
}

export type PublicProfileRow = {
  id: string
  display_name: string
  photo_url: string | null
  city: string | null
}

export type ViewableUserProfile = {
  id: string
  display_name: string
  city: string | null
  phone_e164: string | null
  photo_url: string | null
  badge_showcase: string[]
}

export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  | 'display_name'
  | 'phone_e164'
  | 'city'
  | 'badge_showcase'
  | 'notify_push'
  | 'notify_on_join'
  | 'notify_on_match_start'
  | 'notify_on_match_edit'
  | 'notify_on_match_cancel'
  | 'notify_on_result'
  | 'notify_on_reminder_24h'
  | 'notify_on_reminder_2h'
  | 'notify_on_reminder_in_progress'
  | 'notify_on_friend_request'
  | 'notify_on_match_invitation'
>

const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isOwnProfile(row: ProfileRow | OtherUserProfileRow): row is ProfileRow {
  return 'phone_e164' in row && 'notify_push' in row
}

export async function getProfile(userId: string): Promise<ProfileRow | OtherUserProfileRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id === userId) {
    const { data, error } = await supabase.rpc('get_own_profile')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('Perfil no encontrado')
    return data[0] as ProfileRow
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, city, photo_url, badge_showcase, role, status, created_at, updated_at'
    )
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  return {
    id: data.id,
    display_name: data.display_name,
    city: data.city,
    photo_url: data.photo_url,
    badge_showcase: (data.badge_showcase as string[] | null) ?? [],
    role: data.role,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

export async function getPublicProfile(profileId: string): Promise<PublicProfileRow | null> {
  const { data, error } = await supabase.rpc('get_public_profile', {
    p_profile_id: profileId,
  })

  if (error) return null
  if (!data || data.length === 0) return null

  return data[0] as PublicProfileRow
}

/** Profile card for another user (PII gated server-side). */
export async function getViewableUserProfile(userId: string): Promise<ViewableUserProfile | null> {
  const { data, error } = await supabase.rpc('get_viewable_user_profile', {
    p_user_id: userId,
  })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null

  return data[0] as ViewableUserProfile
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<ProfileRow> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)

  if (error) throw new Error(error.message)
  const row = await getProfile(userId)
  if (!isOwnProfile(row)) throw new Error('Perfil no encontrado')
  return row
}

/**
 * Compress and upload an avatar image to Supabase Storage.
 * Resizes to 400×400 and reduces JPEG quality until the encoded size is ≤500 KB.
 *
 * When `onlyIfEmpty` is true, persists `photo_url` only if it is still null/blank
 * (atomic filter on the UPDATE). Returns `null` on conflict so callers can abort
 * without overwriting a photo set after the initial empty check.
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string,
  mimeType?: string | null,
  options?: { onlyIfEmpty?: boolean }
): Promise<string | null> {
  if (mimeType && !ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato de imagen no permitido')
  }

  const MAX_BYTES = 500 * 1024
  const MAX_BASE64_LEN = Math.ceil(MAX_BYTES / 0.75)

  let quality = 0.85
  let base64: string | undefined

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    )
    base64 = result.base64
    if (!base64 || base64.length <= MAX_BASE64_LEN) break
    quality = Math.max(0.2, quality - 0.15)
  }

  if (!base64) throw new Error('No se pudo comprimir la imagen')

  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  const filePath = `${userId}.jpg`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const photoUrl = `${data.publicUrl}?t=${Date.now()}`

  if (options?.onlyIfEmpty) {
    // Server-side filter: only win if photo_url is still null or blank.
    const { data: updated, error: profileError } = await supabase
      .from('profiles')
      .update({ photo_url: photoUrl })
      .eq('id', userId)
      .or('photo_url.is.null,photo_url.eq.')
      .select('id')
      .maybeSingle()

    if (profileError) throw new Error(profileError.message)
    if (!updated) return null
    return photoUrl
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ photo_url: photoUrl })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  return photoUrl
}
