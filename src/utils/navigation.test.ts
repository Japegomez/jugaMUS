import {
  buildMatchDetailHref,
  buildProfileHref,
  firstSearchParam,
  isSafeTabsHref,
} from '@/utils/navigation'

describe('navigation utils', () => {
  describe('firstSearchParam', () => {
    it('returns first element of array', () => {
      expect(firstSearchParam(['a', 'b'])).toBe('a')
    })

    it('returns string as-is', () => {
      expect(firstSearchParam('solo')).toBe('solo')
    })

    it('returns undefined for missing value', () => {
      expect(firstSearchParam(undefined)).toBeUndefined()
    })
  })

  describe('isSafeTabsHref', () => {
    it('allows in-app tab routes', () => {
      expect(isSafeTabsHref('/(tabs)/matches/m1')).toBe(true)
    })

    it('rejects external or traversal URLs', () => {
      expect(isSafeTabsHref('https://evil.com')).toBe(false)
      expect(isSafeTabsHref('/(tabs)/../secret')).toBe(false)
    })
  })

  describe('buildMatchDetailHref', () => {
    it('builds path with optional query params', () => {
      expect(buildMatchDetailHref('m1')).toBe('/(tabs)/matches/m1')
      expect(buildMatchDetailHref('m1', { from: 'profile', profileUserId: 'u1' })).toBe(
        '/(tabs)/matches/m1?from=profile&profileUserId=u1'
      )
    })
  })

  describe('buildProfileHref', () => {
    it('builds self or other profile routes', () => {
      expect(buildProfileHref()).toBe('/(tabs)/profile')
      expect(buildProfileHref('u2')).toBe('/(tabs)/profile/u2')
    })
  })
})
