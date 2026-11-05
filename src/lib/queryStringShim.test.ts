/**
 * Guards the vendored `decode-uri-component` shim (vendor/decode-uri-component).
 *
 * Upstream 0.5.1 is ESM-only, but `query-string@7` (used by expo-router and
 * @react-navigation/core for deep-link query params) requires it as CJS and
 * calls the module itself as a function. Pointing the override straight at the
 * ESM package made every `query-string.parse()` call throw
 * `decodeComponent is not a function`, silently breaking deep linking.
 *
 * This test drives the real consumer so a future override change cannot
 * regress it without failing CI.
 */
import queryString from 'query-string'

describe('query-string parsing (decode-uri-component shim)', () => {
  it('parses a plain query string', () => {
    expect(queryString.parse('a=1&b=2')).toEqual({ a: '1', b: '2' })
  })

  it('decodes percent-encoded values', () => {
    expect(queryString.parse('name=hello%20world&path=a%2Fb')).toEqual({
      name: 'hello world',
      path: 'a/b',
    })
  })

  it('parses the OAuth callback shape used by auth redirects', () => {
    expect(queryString.parse('code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' })
  })

  it('parses a full url', () => {
    expect(queryString.parseUrl('/reset?token=t1')).toEqual({
      url: '/reset',
      query: { token: 't1' },
    })
  })

  it('leaves a malformed encoding literal instead of throwing', () => {
    expect(() => queryString.parse('bad=%E0%A4%A')).not.toThrow()
    expect(queryString.parse('bad=%E0%A4%A')).toEqual({ bad: '%E0%A4%A' })
  })

  it('still stringifies', () => {
    expect(queryString.stringify({ a: 1, b: 'x y' })).toBe('a=1&b=x%20y')
  })
})
