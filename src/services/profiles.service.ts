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
  notify_push: boolean
  notify_on_join: boolean
  notify_on_match_change: boolean
  notify_on_result: boolean
  notify_on_reminder: boolean
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
}

export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  | 'display_name'
  | 'phone_e164'
  | 'city'
  | 'notify_push'
  | 'notify_on_join'
  | 'notify_on_match_change'
  | 'notify_on_result'
  | 'notify_on_reminder'
>

const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function getProfile(userId: string): Promise<ProfileRow> {
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
      'id, display_name, city, photo_url, role, status, notify_push, notify_on_join, notify_on_match_change, notify_on_result, notify_on_reminder, created_at, updated_at'
    )
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  return { ...(data as Omit<ProfileRow, 'phone_e164'>), phone_e164: '' }
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
  return getProfile(userId)
}

/**
 * Compress and upload an avatar image to Supabase Storage.
 * Resizes to 400×400 and reduces JPEG quality until the encoded size is ≤500 KB.
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string,
  mimeType?: string | null
): Promise<string> {
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

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ photo_url: photoUrl })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  return photoUrl
}
