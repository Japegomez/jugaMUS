const mockStorage = new Map<string, string>()

jest.mock('@/lib/authStorage', () => ({
  getAuthStorage: () => ({
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value)
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key)
    }),
  }),
}))

import {
  BACKGROUND_SESSION_TIMEOUT_MS,
  clearSessionBackgroundMarker,
  isSessionExpiredAfterBackground,
  markSessionBackgrounded,
} from '@/lib/sessionBackground'

describe('sessionBackground', () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('marks and clears background timestamp', async () => {
    await markSessionBackgrounded()
    expect(mockStorage.size).toBe(1)

    await clearSessionBackgroundMarker()
    expect(mockStorage.size).toBe(0)
  })

  it('returns false when no marker exists', async () => {
    await expect(isSessionExpiredAfterBackground()).resolves.toBe(false)
  })

  it('returns true after timeout elapsed', async () => {
    const now = Date.now()
    jest.setSystemTime(now)
    await markSessionBackgrounded()

    jest.setSystemTime(now + BACKGROUND_SESSION_TIMEOUT_MS)
    await expect(isSessionExpiredAfterBackground()).resolves.toBe(true)
  })

  it('clears invalid marker values', async () => {
    mockStorage.set('jugamus.session_backgrounded_at', 'not-a-number')
    await expect(isSessionExpiredAfterBackground()).resolves.toBe(false)
    expect(mockStorage.size).toBe(0)
  })
})
