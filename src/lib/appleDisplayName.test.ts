import {
  DEFAULT_APPLE_FALLBACK_DISPLAY_NAME,
  formatAppleFullName,
  isAppleRelayEmail,
  isRelayDerivedDisplayName,
  resolveAppleProfileDisplayName,
} from '@/lib/appleDisplayName'

describe('formatAppleFullName', () => {
  it('joins given and family names', () => {
    expect(formatAppleFullName({ givenName: 'Ana', familyName: 'García' })).toBe('Ana García')
  })

  it('returns null when name is too short', () => {
    expect(formatAppleFullName({ givenName: 'A' })).toBeNull()
  })
})

describe('isAppleRelayEmail', () => {
  it('detects Apple private relay addresses', () => {
    expect(isAppleRelayEmail('abc123@privaterelay.appleid.com')).toBe(true)
    expect(isAppleRelayEmail('user@gmail.com')).toBe(false)
  })
})

describe('isRelayDerivedDisplayName', () => {
  it('matches relay local part used as display name', () => {
    expect(isRelayDerivedDisplayName('abc123@privaterelay.appleid.com', 'abc123')).toBe(true)
    expect(isRelayDerivedDisplayName('abc123@privaterelay.appleid.com', 'Ana')).toBe(false)
  })
})

describe('resolveAppleProfileDisplayName', () => {
  it('prefers Apple full name when available', () => {
    expect(
      resolveAppleProfileDisplayName({
        appleFullName: { givenName: 'Luis', familyName: 'Pérez' },
        email: 'abc@privaterelay.appleid.com',
        currentDisplayName: 'abc',
      })
    ).toBe('Luis Pérez')
  })

  it('falls back to Usuario for relay-derived names', () => {
    expect(
      resolveAppleProfileDisplayName({
        appleFullName: null,
        email: 'abc@privaterelay.appleid.com',
        currentDisplayName: 'abc',
      })
    ).toBe(DEFAULT_APPLE_FALLBACK_DISPLAY_NAME)
  })

  it('keeps a custom name when Apple does not resend full name', () => {
    expect(
      resolveAppleProfileDisplayName({
        appleFullName: null,
        email: 'abc@privaterelay.appleid.com',
        currentDisplayName: 'Luis',
      })
    ).toBeNull()
  })
})
