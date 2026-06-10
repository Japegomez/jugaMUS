import { RATING_PROMPT_INTERVAL_MS, shouldShowRatingPrompt } from '@/lib/appRating'

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
