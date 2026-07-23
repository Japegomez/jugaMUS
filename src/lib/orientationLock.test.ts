import { __resetOrientationLockForTests, resolveOrientationLock } from '@/lib/orientationLock'
import * as ScreenOrientation from 'expo-screen-orientation'

describe('resolveOrientationLock', () => {
  afterEach(() => {
    __resetOrientationLockForTests()
  })

  it('defaults to portrait when there are no owners', () => {
    expect(resolveOrientationLock([])).toBe(ScreenOrientation.OrientationLock.PORTRAIT_UP)
  })

  it('returns the only requested lock', () => {
    expect(resolveOrientationLock([ScreenOrientation.OrientationLock.PORTRAIT_UP])).toBe(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    )
  })

  it('prefers landscape when portrait and landscape coexist', () => {
    expect(
      resolveOrientationLock([
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ScreenOrientation.OrientationLock.LANDSCAPE,
      ])
    ).toBe(ScreenOrientation.OrientationLock.LANDSCAPE)
  })
})
