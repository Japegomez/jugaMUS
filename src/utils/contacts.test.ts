import { openCreateContactForm, splitDisplayName } from './contacts'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
}))

jest.mock('expo-contacts', () => ({
  ContactTypes: { Person: 'person', Company: 'company' },
  presentFormAsync: jest.fn(async () => undefined),
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

describe('splitDisplayName', () => {
  it('returns empty parts for blank input', () => {
    expect(splitDisplayName('')).toEqual({ givenName: '', familyName: '' })
    expect(splitDisplayName('   ')).toEqual({ givenName: '', familyName: '' })
  })

  it('puts a single token in givenName', () => {
    expect(splitDisplayName('Juan')).toEqual({ givenName: 'Juan', familyName: '' })
  })

  it('splits first token and the rest', () => {
    expect(splitDisplayName('Juan García López')).toEqual({
      givenName: 'Juan',
      familyName: 'García López',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(splitDisplayName('  Ana  Pérez  ')).toEqual({
      givenName: 'Ana',
      familyName: 'Pérez',
    })
  })
})

describe('openCreateContactForm', () => {
  const Contacts = jest.requireMock('expo-contacts') as {
    presentFormAsync: jest.Mock
  }
  const Clipboard = jest.requireMock('expo-clipboard') as {
    setStringAsync: jest.Mock
  }
  const RN = jest.requireMock('react-native') as { Platform: { OS: string } }

  beforeEach(() => {
    jest.clearAllMocks()
    RN.Platform.OS = 'ios'
  })

  it('opens native create-contact form with name and phone', async () => {
    const result = await openCreateContactForm({
      displayName: 'Juan García',
      phoneE164: '+34612345678',
    })

    expect(Contacts.presentFormAsync).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        firstName: 'Juan',
        lastName: 'García',
        phoneNumbers: [expect.objectContaining({ number: '+34612345678', label: 'mobile' })],
      }),
      { isNew: true }
    )
    expect(result).toBe('cancelled')
  })

  it('copies phone on web and returns unsupported', async () => {
    RN.Platform.OS = 'web'
    const result = await openCreateContactForm({
      displayName: 'Juan',
      phoneE164: '+34612345678',
    })

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('+34612345678')
    expect(Contacts.presentFormAsync).not.toHaveBeenCalled()
    expect(result).toBe('unsupported')
  })

  it('returns error when phone is empty', async () => {
    await expect(openCreateContactForm({ displayName: 'Juan', phoneE164: '  ' })).resolves.toBe(
      'error'
    )
  })
})
