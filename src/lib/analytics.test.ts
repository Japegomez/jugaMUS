const mockStorage = new Map()

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

jest.mock('@/lib/authStorage', () => ({
  getAuthStorage: () => ({
    getItem: jest.fn(async (key) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      mockStorage.set(key, value)
    }),
    removeItem: jest.fn(async (key) => {
      mockStorage.delete(key)
    }),
  }),
}))

import { MATCH_STATUS } from '@/constants'
import { posthog } from '@/lib/posthog'
import { supabase } from '@/lib/supabase'
import {
  __resetAnalyticsGuardsForTests,
  AnalyticsEvents,
  identifyUser,
  isLikelyNewAuthUser,
  resetAnalytics,
  trackMatchCompletedIfFinished,
  trackMatchCompletedOnce,
  trackMatchCreated,
  trackMatchJoined,
  trackUserSignedUp,
} from '@/lib/analytics'

describe('analytics helpers', () => {
  beforeEach(() => {
    mockStorage.clear()
    __resetAnalyticsGuardsForTests()
    jest.clearAllMocks()
  })

  it('exposes funnel event names', () => {
    expect(AnalyticsEvents.USER_SIGNED_UP).toBe('user_signed_up')
    expect(AnalyticsEvents.MATCH_CREATED).toBe('match_created')
    expect(AnalyticsEvents.MATCH_JOINED).toBe('match_joined')
    expect(AnalyticsEvents.MATCH_COMPLETED).toBe('match_completed')
  })

  it('identifyUser and resetAnalytics delegate to posthog', () => {
    identifyUser('user-1', { plan: 'free' })
    expect(posthog.identify).toHaveBeenCalledWith('user-1', { plan: 'free' })

    identifyUser('')
    expect(posthog.identify).toHaveBeenCalledTimes(1)

    resetAnalytics()
    expect(posthog.reset).toHaveBeenCalledTimes(1)
  })

  it('captures the four product events', async () => {
    trackUserSignedUp('email')
    trackMatchCreated('m1', 'public')
    trackMatchJoined('m1', 'A')
    await trackMatchCompletedOnce('m1')

    expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEvents.USER_SIGNED_UP, {
      method: 'email',
    })
    expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEvents.MATCH_CREATED, {
      match_id: 'm1',
      visibility: 'public',
    })
    expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEvents.MATCH_JOINED, {
      match_id: 'm1',
      team: 'A',
    })
    expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEvents.MATCH_COMPLETED, {
      match_id: 'm1',
    })
  })

  it('emits match_completed only once per match id', async () => {
    await trackMatchCompletedOnce('m-dup')
    await trackMatchCompletedOnce('m-dup')
    expect(posthog.capture).toHaveBeenCalledTimes(1)
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

  it('returns false when last_sign_in_at is missing', () => {
    expect(
      isLikelyNewAuthUser({
        created_at: '2026-07-23T10:00:00.000Z',
        last_sign_in_at: null,
      })
    ).toBe(false)
    expect(
      isLikelyNewAuthUser({
        created_at: '2026-07-23T10:00:00.000Z',
      })
    ).toBe(false)
  })

  describe('trackMatchCompletedIfFinished', () => {
    function mockMatchSelect(result) {
      const maybeSingle = jest.fn().mockResolvedValue(result)
      const eq = jest.fn().mockReturnValue({ maybeSingle })
      const select = jest.fn().mockReturnValue({ eq })
      supabase.from.mockReturnValue({ select })
    }

    it('captures when status is finished', async () => {
      mockMatchSelect({ data: { status: MATCH_STATUS.FINISHED }, error: null })
      await trackMatchCompletedIfFinished('m-fin')
      expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEvents.MATCH_COMPLETED, {
        match_id: 'm-fin',
      })
    })

    it('does not capture when status is not finished', async () => {
      mockMatchSelect({ data: { status: 'in_progress' }, error: null })
      await trackMatchCompletedIfFinished('m-open')
      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('does not capture on supabase error', async () => {
      mockMatchSelect({ data: null, error: { message: 'boom' } })
      await trackMatchCompletedIfFinished('m-err')
      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('does not capture when row is absent', async () => {
      mockMatchSelect({ data: null, error: null })
      await trackMatchCompletedIfFinished('m-missing')
      expect(posthog.capture).not.toHaveBeenCalled()
    })
  })
})
