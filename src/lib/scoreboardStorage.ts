import { Platform } from 'react-native'

import type { LiveScoreboardState } from '@/hooks/useLiveScoreboard'

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

const webStorage: StorageAdapter = {
  getItem(key) {
    try {
      if (typeof globalThis === 'undefined') return Promise.resolve(null)
      const win = globalThis as typeof globalThis & { localStorage?: Storage }
      if (!win.localStorage) return Promise.resolve(null)
      return Promise.resolve(win.localStorage.getItem(key))
    } catch {
      return Promise.resolve(null)
    }
  },
  setItem(key, value) {
    try {
      const win = globalThis as typeof globalThis & { localStorage?: Storage }
      win.localStorage?.setItem(key, value)
    } catch {
      /* quota / private mode */
    }
    return Promise.resolve()
  },
  removeItem(key) {
    try {
      const win = globalThis as typeof globalThis & { localStorage?: Storage }
      win.localStorage?.removeItem(key)
    } catch {
      /* ignore */
    }
    return Promise.resolve()
  },
}

let cached: StorageAdapter | null = null

function getStorage(): StorageAdapter {
  if (cached) return cached
  if (Platform.OS === 'web') {
    cached = webStorage
    return cached
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- evitar import estático en web
  cached = require('@react-native-async-storage/async-storage').default as StorageAdapter
  return cached
}

function scoreboardKey(matchId: string) {
  return `jugamus.scoreboard.${matchId}`
}

export async function loadScoreboardState(matchId: string): Promise<LiveScoreboardState | null> {
  const raw = await getStorage().getItem(scoreboardKey(matchId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as LiveScoreboardState
  } catch {
    return null
  }
}

export async function saveScoreboardState(
  matchId: string,
  state: LiveScoreboardState
): Promise<void> {
  await getStorage().setItem(scoreboardKey(matchId), JSON.stringify(state))
}

export async function clearScoreboardState(matchId: string): Promise<void> {
  await getStorage().removeItem(scoreboardKey(matchId))
}
