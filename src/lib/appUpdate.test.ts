jest.mock('@/lib/authStorage', () => {
  const store: Record<string, string> = {}
  return {
    getAuthStorage: () => ({
      getItem: (key: string) => Promise.resolve(store[key] ?? null),
      setItem: (key: string, value: string) => {
        store[key] = value
        return Promise.resolve()
      },
      removeItem: (key: string) => {
        delete store[key]
        return Promise.resolve()
      },
    }),
  }
})

import {
  UPDATE_SNOOZE_MS,
  isMinorOrMajorUpgrade,
  isSnoozed,
  parseUpdatePayload,
  parseMajorMinor,
} from '@/lib/appUpdate'

describe('parseMajorMinor', () => {
  it('parses standard semver', () => {
    expect(parseMajorMinor('1.5.0')).toEqual({ major: 1, minor: 5 })
  })

  it('parses major.minor without patch', () => {
    expect(parseMajorMinor('2.3')).toEqual({ major: 2, minor: 3 })
  })

  it('returns null for invalid input', () => {
    expect(parseMajorMinor('notaversion')).toBeNull()
    expect(parseMajorMinor('1')).toBeNull()
    expect(parseMajorMinor('')).toBeNull()
  })
})

describe('isMinorOrMajorUpgrade', () => {
  it('returns false when versions are equal', () => {
    expect(isMinorOrMajorUpgrade('1.5.0', '1.5.0')).toBe(false)
  })

  it('returns false for a patch increment only', () => {
    expect(isMinorOrMajorUpgrade('1.5.0', '1.5.1')).toBe(false)
  })

  it('returns true for a minor increment', () => {
    expect(isMinorOrMajorUpgrade('1.5.0', '1.6.0')).toBe(true)
  })

  it('returns true for a major increment', () => {
    expect(isMinorOrMajorUpgrade('1.5.0', '2.0.0')).toBe(true)
  })

  it('returns false when remote is older', () => {
    expect(isMinorOrMajorUpgrade('1.5.0', '1.4.9')).toBe(false)
  })

  it('returns false on unparseable versions', () => {
    expect(isMinorOrMajorUpgrade('bad', '1.6.0')).toBe(false)
    expect(isMinorOrMajorUpgrade('1.5.0', 'bad')).toBe(false)
  })
})

describe('parseUpdatePayload', () => {
  it('accepts a valid payload', () => {
    const result = parseUpdatePayload({ latestVersion: '1.6.0' })
    expect(result).toEqual({ latestVersion: '1.6.0', title: undefined, message: undefined })
  })

  it('accepts optional title and message', () => {
    const result = parseUpdatePayload({
      latestVersion: '1.6.0',
      title: 'Nuevo',
      message: 'Correcciones',
    })
    expect(result?.title).toBe('Nuevo')
    expect(result?.message).toBe('Correcciones')
  })

  it('parses a JSON string payload', () => {
    const result = parseUpdatePayload('{"latestVersion":"1.6.0"}')
    expect(result?.latestVersion).toBe('1.6.0')
  })

  it('rejects null', () => {
    expect(parseUpdatePayload(null)).toBeNull()
  })

  it('rejects arrays', () => {
    expect(parseUpdatePayload([])).toBeNull()
  })

  it('rejects missing latestVersion', () => {
    expect(parseUpdatePayload({ title: 'foo' })).toBeNull()
  })

  it('rejects empty latestVersion', () => {
    expect(parseUpdatePayload({ latestVersion: '   ' })).toBeNull()
  })
})

describe('isSnoozed', () => {
  const { getAuthStorage } = jest.requireMock('@/lib/authStorage') as {
    getAuthStorage: () => { setItem: (k: string, v: string) => Promise<void> }
  }

  it('returns false when no snooze is recorded', async () => {
    await expect(isSnoozed('1.6.0', Date.now())).resolves.toBe(false)
  })

  it('returns true within snooze window', async () => {
    const now = Date.now()
    await getAuthStorage().setItem('jugamus.update_snoozed_at.1.6', String(now - 1000))
    await expect(isSnoozed('1.6.0', now)).resolves.toBe(true)
  })

  it('returns false after snooze window expires', async () => {
    const now = Date.now()
    await getAuthStorage().setItem(
      'jugamus.update_snoozed_at.1.6',
      String(now - UPDATE_SNOOZE_MS - 1)
    )
    await expect(isSnoozed('1.6.0', now)).resolves.toBe(false)
  })
})
