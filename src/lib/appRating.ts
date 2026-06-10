import { Platform } from 'react-native'

import { getAuthStorage } from '@/lib/authStorage'

/** Interval between rating prompts (3 days). */
export const RATING_PROMPT_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

function ratingPromptKey(userId: string): string {
  return `jugamus.rating_prompt_at.${userId}`
}

export function isRatingPromptSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android'
}

export function shouldShowRatingPrompt(lastPromptAt: number | null, now = Date.now()): boolean {
  if (lastPromptAt === null) return false
  return now - lastPromptAt >= RATING_PROMPT_INTERVAL_MS
}

async function readLastPromptAt(userId: string): Promise<number | null> {
  const raw = await getAuthStorage().getItem(ratingPromptKey(userId))
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    await getAuthStorage().removeItem(ratingPromptKey(userId))
    return null
  }
  return parsed
}

/** Returns true when the in-app rating prompt should be shown. */
export async function checkShouldShowRatingPrompt(userId: string): Promise<boolean> {
  if (!isRatingPromptSupported()) return false

  const lastPromptAt = await readLastPromptAt(userId)
  if (lastPromptAt === null) {
    await markRatingPromptShown(userId)
    return false
  }

  return shouldShowRatingPrompt(lastPromptAt)
}

export async function markRatingPromptShown(userId: string): Promise<void> {
  await getAuthStorage().setItem(ratingPromptKey(userId), String(Date.now()))
}
