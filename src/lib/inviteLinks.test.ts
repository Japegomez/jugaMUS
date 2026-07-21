import {
  buildMatchHttpsInviteUrl,
  buildTournamentHttpsInviteUrl,
  getInviteHost,
} from './inviteLinks'

describe('inviteLinks', () => {
  const prev = process.env.EXPO_PUBLIC_INVITE_HOST

  beforeEach(() => {
    process.env.EXPO_PUBLIC_INVITE_HOST = 'jugamus.web.app'
  })

  afterEach(() => {
    process.env.EXPO_PUBLIC_INVITE_HOST = prev
  })

  it('reads invite host without protocol', () => {
    expect(getInviteHost()).toBe('jugamus.web.app')
  })

  it('strips protocol and trailing slash from env host', () => {
    process.env.EXPO_PUBLIC_INVITE_HOST = 'https://jugamus.web.app/'
    expect(getInviteHost()).toBe('jugamus.web.app')
  })

  it('builds match HTTPS URL', () => {
    expect(buildMatchHttpsInviteUrl('abc-123')).toBe('https://jugamus.web.app/m/abc-123')
  })

  it('builds tournament HTTPS URL', () => {
    expect(buildTournamentHttpsInviteUrl('t-9')).toBe('https://jugamus.web.app/t/t-9')
  })

  it('throws when invite host is missing', () => {
    delete process.env.EXPO_PUBLIC_INVITE_HOST
    expect(() => buildMatchHttpsInviteUrl('x')).toThrow(/EXPO_PUBLIC_INVITE_HOST/)
  })
})
