import { inviteHrefFromSegments } from './inviteDeepLink'

describe('inviteHrefFromSegments', () => {
  it('maps HTTPS match stub', () => {
    expect(inviteHrefFromSegments(['m', 'abc'])).toBe('/(tabs)/matches/abc')
  })

  it('maps HTTPS tournament stub', () => {
    expect(inviteHrefFromSegments(['t', 'xyz'])).toBe('/(tabs)/tournaments/xyz')
  })

  it('maps custom-scheme match entry', () => {
    expect(inviteHrefFromSegments(['matches', 'abc'])).toBe('/(tabs)/matches/abc')
  })

  it('maps tabs tournament detail', () => {
    expect(inviteHrefFromSegments(['(tabs)', 'tournaments', 't1'])).toBe('/(tabs)/tournaments/t1')
  })

  it('ignores create/edit and non-invite routes', () => {
    expect(inviteHrefFromSegments(['(tabs)', 'matches', 'create'])).toBeNull()
    expect(inviteHrefFromSegments(['(tabs)', 'matches'])).toBeNull()
    expect(inviteHrefFromSegments(['(auth)', 'login'])).toBeNull()
  })
})
