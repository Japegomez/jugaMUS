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

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

import {
  RATING_PROMPT_INTERVAL_MS,
  checkShouldShowRatingPrompt,
  isRatingPromptSupported,
  markRatingPromptShown,
  shouldShowRatingPrompt,
} from '@/lib/appRating'

describe('shouldShowRatingPrompt', () => {
  const now = 1_700_000_000_000

  it('returns false when never prompted before', () => {
    expect(shouldShowRatingPrompt(null, now)).toBe(false)
  })

  it('returns false before 3 days have passed', () => {
    const lastPrompt = now - RATING_PROMPT_INTERVAL_MS + 1
    expect(shouldShowRatingPrompt(lastPrompt, now)).toBe(false)
  })

  it('returns true after 3 days have passed', () => {
    const lastPrompt = now - RATING_PROMPT_INTERVAL_MS
    expect(shouldShowRatingPrompt(lastPrompt, now)).toBe(true)
  })
})

describe('checkShouldShowRatingPrompt', () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-11T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('is supported on ios/android', () => {
    expect(isRatingPromptSupported()).toBe(true)
  })

  it('seeds prompt timestamp and returns false on first check', async () => {
    await expect(checkShouldShowRatingPrompt('u1')).resolves.toBe(false)
    expect(mockStorage.has('jugamus.rating_prompt_at.u1')).toBe(true)
  })

  it('returns true after interval elapsed', async () => {
    await markRatingPromptShown('u1')
    jest.setSystemTime(Date.now() + RATING_PROMPT_INTERVAL_MS + 1)
    await expect(checkShouldShowRatingPrompt('u1')).resolves.toBe(true)
  })

  it('clears invalid stored timestamps', async () => {
    mockStorage.set('jugamus.rating_prompt_at.u1', 'not-a-number')
    await expect(checkShouldShowRatingPrompt('u1')).resolves.toBe(false)
    // first check after clear seeds a new timestamp
    expect(Number(mockStorage.get('jugamus.rating_prompt_at.u1'))).toBeGreaterThan(0)
  })
})
