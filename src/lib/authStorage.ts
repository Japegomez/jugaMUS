import { Platform } from 'react-native'

/**
 * Supabase Auth storage adapter.
 * - Web: `localStorage` (no bridge).
 * - Native: AsyncStorage v2.x (Expo SDK 54 / Expo Go; v3.x TurboModule no está disponible ahí).
 * `require` en nativo evita cargar el módulo en bundles web.
 */
type AuthStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

const webStorage: AuthStorage = {
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

let cached: AuthStorage | null = null

export function getAuthStorage(): AuthStorage {
  if (cached) return cached
  if (Platform.OS === 'web') {
    cached = webStorage
    return cached
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- evitar import estático en web
  cached = require('@react-native-async-storage/async-storage').default as AuthStorage
  return cached
}
