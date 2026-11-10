jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-nonce-1'),
}))

jest.mock('@/lib/authStorage', () => ({
  getAuthStorage: jest.fn(),
}))

import * as Crypto from 'expo-crypto'
import { getAuthStorage } from '@/lib/authStorage'
import { consumeAuthFlowNonce, createAndPersistAuthFlowNonce } from '@/lib/authFlowNonce'

describe('authFlowNonce', () => {
  const storage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getAuthStorage).mockReturnValue(storage)
    jest.mocked(Crypto.randomUUID).mockReturnValue('uuid-nonce-1')
    storage.setItem.mockResolvedValue(undefined)
    storage.removeItem.mockResolvedValue(undefined)
  })

  it('persists a random nonce with TTL', async () => {
    const now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)

    await expect(createAndPersistAuthFlowNonce()).resolves.toBe('uuid-nonce-1')
    expect(storage.setItem).toHaveBeenCalledWith(
      'jugamus.auth_flow_nonce',
      JSON.stringify({ value: 'uuid-nonce-1', expiresAt: now + 30 * 60 * 1000 })
    )
  })

  it('consumes a matching non-expired nonce once', async () => {
    const now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    storage.getItem.mockResolvedValue(
      JSON.stringify({ value: 'uuid-nonce-1', expiresAt: now + 60_000 })
    )

    await expect(consumeAuthFlowNonce('uuid-nonce-1')).resolves.toBe(true)
    expect(storage.removeItem).toHaveBeenCalledWith('jugamus.auth_flow_nonce')
  })

  it('rejects missing, mismatched, or expired nonces', async () => {
    const now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)

    storage.getItem.mockResolvedValueOnce(null)
    await expect(consumeAuthFlowNonce('x')).resolves.toBe(false)

    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ value: 'other', expiresAt: now + 60_000 })
    )
    await expect(consumeAuthFlowNonce('uuid-nonce-1')).resolves.toBe(false)

    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ value: 'uuid-nonce-1', expiresAt: now - 1 })
    )
    await expect(consumeAuthFlowNonce('uuid-nonce-1')).resolves.toBe(false)
  })
})
