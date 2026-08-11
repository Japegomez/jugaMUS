import { supabase } from '@/lib/supabase'
import { SESSION_EXPIRED_MESSAGE, validateAuthSession } from '@/lib/validateAuthSession'

const mockSupabase = supabase as unknown as {
  auth: {
    getUser: jest.Mock
    signOut: jest.Mock
  }
}

describe('validateAuthSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null session when input is null', async () => {
    await expect(validateAuthSession(null)).resolves.toEqual({
      session: null,
      expired: false,
    })
  })

  it('keeps session when getUser succeeds', async () => {
    const session = { user: { id: 'u1' } } as never
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await expect(validateAuthSession(session)).resolves.toEqual({
      session,
      expired: false,
    })
  })

  it('expires session on auth failure and signs out locally', async () => {
    const session = { user: { id: 'u1' } } as never
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired', status: 401 },
    })

    const result = await validateAuthSession(session)
    expect(result.expired).toBe(true)
    expect(result.session).toBeNull()
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('preserves session on transient network errors', async () => {
    const session = { user: { id: 'u1' } } as never
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network request failed', status: 0, name: 'AuthRetryableFetchError' },
    })

    await expect(validateAuthSession(session)).resolves.toEqual({
      session,
      expired: false,
    })
  })

  it('exports session expired message', () => {
    expect(SESSION_EXPIRED_MESSAGE).toContain('caducado')
  })
})
