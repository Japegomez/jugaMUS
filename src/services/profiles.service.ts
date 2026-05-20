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
  notify_email: boolean
  notify_push: boolean
  notify_on_join: boolean
  notify_on_match_change: boolean
  notify_on_result: boolean
  notify_on_reminder: boolean
  created_at: string
  updated_at: string
}

export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  | 'display_name'
  | 'phone_e164'
  | 'city'
  | 'notify_email'
  | 'notify_push'
  | 'notify_on_join'
  | 'notify_on_match_change'
  | 'notify_on_result'
  | 'notify_on_reminder'
  | 'photo_url'
>

export async function getProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

  if (error) throw new Error(error.message)
  return data as ProfileRow
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ProfileRow
}

/**
 * Compress and upload an avatar image to Supabase Storage.
 * Resizes to 400×400 and reduces JPEG quality until the encoded size is ≤500 KB.
 *
 * Uses expo-image-manipulator's `base64: true` option to avoid Blob.arrayBuffer(),
 * which is not implemented in React Native's Hermes engine.
 */
export async function uploadAvatar(userId: string, imageUri: string): Promise<string> {
  // base64-encoded byte length ≈ base64.length * 0.75
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

  // Decode base64 → Uint8Array (works in Hermes without Blob.arrayBuffer)
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

  // Bust CDN cache by appending a timestamp query param
  return `${data.publicUrl}?t=${Date.now()}`
}
