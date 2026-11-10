jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string, opts?: { queryParams?: Record<string, string> }) => {
    const qs = opts?.queryParams ? `?${new URLSearchParams(opts.queryParams).toString()}` : ''
    return `jugamus://${path}${qs}`
  }),
}))

jest.mock('@/lib/authFlowNonce', () => ({
  createAndPersistAuthFlowNonce: jest.fn(async () => 'test-nonce'),
}))

import * as Linking from 'expo-linking'

import {
  getOAuthRedirectUrl,
  getPasswordResetRedirectUrl,
  NATIVE_OAUTH_REDIRECT_EXAMPLE,
} from '@/lib/authRedirect'
import { createAndPersistAuthFlowNonce } from '@/lib/authFlowNonce'
import { APP_OAUTH_CALLBACK_PATH, APP_PASSWORD_UPDATE_PATH } from '@/constants/app'

describe('authRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createAndPersistAuthFlowNonce).mockResolvedValue('test-nonce')
  })

  it('builds OAuth redirect via Linking.createURL with nonce', async () => {
    await expect(getOAuthRedirectUrl()).resolves.toBe(
      `jugamus://${APP_OAUTH_CALLBACK_PATH}?n=test-nonce`
    )
    expect(createAndPersistAuthFlowNonce).toHaveBeenCalled()
    expect(Linking.createURL).toHaveBeenCalledWith(APP_OAUTH_CALLBACK_PATH, {
      queryParams: { n: 'test-nonce' },
    })
  })

  it('builds password reset redirect with nonce', async () => {
    await expect(getPasswordResetRedirectUrl()).resolves.toBe(
      `jugamus://${APP_PASSWORD_UPDATE_PATH}?n=test-nonce`
    )
  })

  it('documents native redirect example', () => {
    expect(NATIVE_OAUTH_REDIRECT_EXAMPLE).toBe(`jugamus://${APP_OAUTH_CALLBACK_PATH}`)
  })
})
