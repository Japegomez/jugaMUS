import * as Crypto from 'expo-crypto'

import { getAuthStorage } from '@/lib/authStorage'

const STORAGE_KEY = 'jugamus.auth_flow_nonce'
/** Nonce TTL: long enough for email round-trips, short enough to limit replay. */
const TTL_MS = 30 * 60 * 1000

type StoredNonce = {
  value: string
  expiresAt: number
}

export async function createAndPersistAuthFlowNonce(): Promise<string> {
  const value = Crypto.randomUUID()
  const payload: StoredNonce = {
    value,
    expiresAt: Date.now() + TTL_MS,
  }
  await getAuthStorage().setItem(STORAGE_KEY, JSON.stringify(payload))
  return value
}

/**
 * Validates `presented` against the persisted nonce and always clears storage (one-time use).
 * Returns false when missing, expired, malformed, or mismatched.
 */
export async function consumeAuthFlowNonce(presented: string | null | undefined): Promise<boolean> {
  const storage = getAuthStorage()
  const raw = await storage.getItem(STORAGE_KEY)
  await storage.removeItem(STORAGE_KEY)

  if (!presented || !raw) {
    return false
  }

  try {
    const parsed = JSON.parse(raw) as StoredNonce
    if (typeof parsed.value !== 'string' || typeof parsed.expiresAt !== 'number') {
      return false
    }
    if (Date.now() > parsed.expiresAt) {
      return false
    }
    return parsed.value === presented
  } catch {
    return false
  }
}
