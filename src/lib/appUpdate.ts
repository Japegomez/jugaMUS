import { Linking, Platform } from 'react-native'

import * as Application from 'expo-application'
import * as StoreReview from 'expo-store-review'

import { getAuthStorage } from '@/lib/authStorage'

export const UPDATE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

const APP_STORE_URL = 'https://apps.apple.com/app/id6775626292'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.javiwacho.musapp'

export interface AppUpdatePayload {
  latestVersion: string
  title?: string
  message?: string
}

/** Returns { major, minor } integers or null when the string is not semver-like. */
export function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const parts = version.split('.')
  if (parts.length < 2) return null
  const major = parseInt(parts[0], 10)
  const minor = parseInt(parts[1], 10)
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
  return { major, minor }
}

/**
 * Returns true when `remote` has a higher major.minor than `installed`.
 * Patch increments do not trigger the prompt.
 */
export function isMinorOrMajorUpgrade(installed: string, remote: string): boolean {
  const a = parseMajorMinor(installed)
  const b = parseMajorMinor(remote)
  if (!a || !b) return false
  if (b.major > a.major) return true
  return b.major === a.major && b.minor > a.minor
}

/** Validates the raw feature-flag payload (may be an arbitrary JSON value or a JSON string). */
export function parseUpdatePayload(raw: unknown): AppUpdatePayload | null {
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.latestVersion !== 'string' || !obj.latestVersion.trim()) return null
  return {
    latestVersion: obj.latestVersion.trim(),
    title: typeof obj.title === 'string' ? obj.title : undefined,
    message: typeof obj.message === 'string' ? obj.message : undefined,
  }
}

// Key includes major.minor so a new minor clears any existing snooze automatically.
function snoozeKey(majorMinor: string): string {
  return `jugamus.update_snoozed_at.${majorMinor}`
}

function majorMinorLabel(version: string): string {
  const parsed = parseMajorMinor(version)
  return parsed ? `${parsed.major}.${parsed.minor}` : version
}

export async function isSnoozed(latestVersion: string, now = Date.now()): Promise<boolean> {
  const key = snoozeKey(majorMinorLabel(latestVersion))
  const raw = await getAuthStorage().getItem(key)
  if (!raw) return false
  const at = Number(raw)
  if (!Number.isFinite(at)) return false
  return now - at < UPDATE_SNOOZE_MS
}

export async function snoozeUpdate(latestVersion: string): Promise<void> {
  const key = snoozeKey(majorMinorLabel(latestVersion))
  await getAuthStorage().setItem(key, String(Date.now()))
}

/**
 * Evaluates whether the update prompt should be shown.
 * Returns the payload to display, or null if the prompt should be suppressed.
 */
export async function checkShouldShowUpdatePrompt(
  rawPayload: unknown
): Promise<AppUpdatePayload | null> {
  if (Platform.OS === 'web') return null

  const payload = parseUpdatePayload(rawPayload)
  if (!payload) return null

  const installed = Application.nativeApplicationVersion
  if (!installed) return null

  if (!isMinorOrMajorUpgrade(installed, payload.latestVersion)) return null

  const snoozed = await isSnoozed(payload.latestVersion)
  if (snoozed) return null

  return payload
}

/** Opens the appropriate store listing. Falls back silently on any error. */
export async function openStoreListing(): Promise<void> {
  try {
    const url = StoreReview.storeUrl() ?? (Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL)
    if (url && (await Linking.canOpenURL(url))) {
      await Linking.openURL(url)
    }
  } catch {
    // non-critical — the user can update manually
  }
}
