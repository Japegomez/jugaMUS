import { emailFromAccessToken } from '@/lib/authDeepLinkIdentity'

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

describe('authDeepLinkIdentity', () => {
  it('reads email from access token payload', () => {
    const token = makeJwt({ email: 'player@example.com', sub: 'u1' })
    expect(emailFromAccessToken(token)).toBe('player@example.com')
  })

  it('returns null for malformed tokens', () => {
    expect(emailFromAccessToken('not-a-jwt')).toBeNull()
    expect(emailFromAccessToken(makeJwt({ sub: 'u1' }))).toBeNull()
  })
})
