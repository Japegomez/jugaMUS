jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `jugamus://${path}`),
}))

import * as Linking from 'expo-linking'

import {
  getOAuthRedirectUrl,
  getPasswordResetRedirectUrl,
  NATIVE_OAUTH_REDIRECT_EXAMPLE,
} from '@/lib/authRedirect'
import { APP_OAUTH_CALLBACK_PATH, APP_PASSWORD_UPDATE_PATH } from '@/constants/app'

describe('authRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds OAuth redirect via Linking.createURL', () => {
    expect(getOAuthRedirectUrl()).toBe(`jugamus://${APP_OAUTH_CALLBACK_PATH}`)
    expect(Linking.createURL).toHaveBeenCalledWith(APP_OAUTH_CALLBACK_PATH)
  })

  it('builds password reset redirect', () => {
    expect(getPasswordResetRedirectUrl()).toBe(`jugamus://${APP_PASSWORD_UPDATE_PATH}`)
  })

  it('documents native redirect example', () => {
    expect(NATIVE_OAUTH_REDIRECT_EXAMPLE).toBe(`jugamus://${APP_OAUTH_CALLBACK_PATH}`)
  })
})
