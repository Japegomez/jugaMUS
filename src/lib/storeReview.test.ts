import { Alert, Linking, Platform } from 'react-native'
import * as StoreReview from 'expo-store-review'

import { requestAppStoreRating } from '@/lib/storeReview'

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(async () => undefined),
  storeUrl: jest.fn(() => 'https://store.example/app'),
}))

describe('storeReview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows web-only alert on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)

    await requestAppStoreRating()

    expect(alertSpy).toHaveBeenCalledWith(
      'Valorar app',
      expect.stringContaining('solo está disponible en la app móvil')
    )
  })

  it('requests in-app review when available', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    ;(StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true)

    await requestAppStoreRating()

    expect(StoreReview.requestReview).toHaveBeenCalled()
  })

  it('opens store URL when in-app review unavailable', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    ;(StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false)
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

    await requestAppStoreRating()

    expect(openSpy).toHaveBeenCalledWith('https://store.example/app')
  })
})
