import { entryFeeToFormValue, formatEntryFee, parseEntryFeeInput } from './tournamentForm'

describe('parseEntryFeeInput', () => {
  it('returns null for empty', () => {
    expect(parseEntryFeeInput('')).toBeNull()
    expect(parseEntryFeeInput('   ')).toBeNull()
    expect(parseEntryFeeInput(null)).toBeNull()
  })

  it('parses integers and decimals with comma or dot', () => {
    expect(parseEntryFeeInput('10')).toBe(10)
    expect(parseEntryFeeInput('10,5')).toBe(10.5)
    expect(parseEntryFeeInput('10.50')).toBe(10.5)
  })

  it('rejects invalid values', () => {
    expect(() => parseEntryFeeInput('abc')).toThrow()
    expect(() => parseEntryFeeInput('10,555')).toThrow()
    expect(() => parseEntryFeeInput('-1')).toThrow()
  })
})

describe('formatEntryFee', () => {
  it('formats euros in es-ES', () => {
    expect(formatEntryFee(10)).toMatch(/10/)
    expect(formatEntryFee(10.5)).toMatch(/10[,.]50/)
    expect(formatEntryFee(null)).toBeNull()
  })
})

describe('entryFeeToFormValue', () => {
  it('maps null and numbers for the form', () => {
    expect(entryFeeToFormValue(null)).toBe('0')
    expect(entryFeeToFormValue(10)).toBe('10')
    expect(entryFeeToFormValue('12.5')).toBe('12.5')
  })
})
