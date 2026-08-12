import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl'

describe('parseAuthCallbackUrl', () => {
  it('rejects unknown schemes', () => {
    expect(parseAuthCallbackUrl('https://evil.com/callback#access_token=x')).toEqual({
      access_token: null,
      refresh_token: null,
      code: null,
    })
  })

  it('parses tokens from hash fragment', () => {
    expect(
      parseAuthCallbackUrl('jugamus://auth/callback#access_token=at&refresh_token=rt&code=c1')
    ).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      code: 'c1',
    })
  })

  it('parses code from query string', () => {
    expect(parseAuthCallbackUrl('jugamus://auth/callback?code=pkce-code')).toEqual({
      access_token: null,
      refresh_token: null,
      code: 'pkce-code',
    })
  })

  it('merges hash and query params', () => {
    expect(
      parseAuthCallbackUrl('jugamus://auth/callback?code=from-query#access_token=from-hash')
    ).toEqual({
      access_token: 'from-hash',
      refresh_token: null,
      code: 'from-query',
    })
  })
})
