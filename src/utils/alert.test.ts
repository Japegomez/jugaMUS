import { Alert, Platform } from 'react-native'

import { acknowledgeAlert, confirmAlert, showAlert } from '@/utils/alert'

describe('alert utils', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
    jest.restoreAllMocks()
  })

  describe('confirmAlert on native', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
        buttons?.[1]?.onPress?.()
      })
    })

    it('resolves true when confirm is pressed', async () => {
      await expect(confirmAlert('Título', 'Mensaje')).resolves.toBe(true)
    })

    it('uses custom button labels', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
        expect(buttons?.[0]?.text).toBe('No')
        expect(buttons?.[1]?.text).toBe('Sí')
        buttons?.[0]?.onPress?.()
      })

      await expect(confirmAlert('T', 'M', { confirmText: 'Sí', cancelText: 'No' })).resolves.toBe(
        false
      )
    })
  })

  describe('confirmAlert on web', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
      Object.defineProperty(globalThis, 'confirm', {
        value: jest.fn(() => true),
        configurable: true,
      })
    })

    it('uses window.confirm', async () => {
      await expect(confirmAlert('T', 'M')).resolves.toBe(true)
      expect(globalThis.confirm).toHaveBeenCalled()
    })
  })

  describe('showAlert', () => {
    it('calls Alert.alert on native', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
      const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
      showAlert('Hola', 'Mundo')
      expect(spy).toHaveBeenCalledWith('Hola', 'Mundo')
    })
  })

  describe('acknowledgeAlert', () => {
    it('resolves after OK on native', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.[0]?.onPress?.()
      })

      await expect(acknowledgeAlert('Info', 'Detalle')).resolves.toBeUndefined()
    })
  })
})
