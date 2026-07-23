jest.mock('@/lib/posthog', () => ({
  posthog: {
    identify: jest.fn(),
    reset: jest.fn(),
    capture: jest.fn(),
  },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

import { AnalyticsEvents, isLikelyNewAuthUser } from '@/lib/analytics'

describe('analytics helpers', () => {
  it('exposes funnel event names', () => {
    expect(AnalyticsEvents.USER_SIGNED_UP).toBe('user_signed_up')
    expect(AnalyticsEvents.MATCH_CREATED).toBe('match_created')
    expect(AnalyticsEvents.MATCH_JOINED).toBe('match_joined')
    expect(AnalyticsEvents.MATCH_COMPLETED).toBe('match_completed')
  })

  it('detects likely new auth users within two minutes', () => {
    const created = '2026-07-23T10:00:00.000Z'
    expect(
      isLikelyNewAuthUser({
        created_at: created,
        last_sign_in_at: '2026-07-23T10:00:30.000Z',
      })
    ).toBe(true)
    expect(
      isLikelyNewAuthUser({
        created_at: created,
        last_sign_in_at: '2026-07-24T10:00:00.000Z',
      })
    ).toBe(false)
  })
})
