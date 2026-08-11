import { formatDate, formatPhone } from '@/utils/formatters'

describe('formatters', () => {
  describe('formatDate', () => {
    it('formats ISO date in es-ES locale', () => {
      const formatted = formatDate('2026-01-15T14:30:00.000Z')
      expect(formatted).toMatch(/\d{2}/)
      expect(formatted.toLowerCase()).toMatch(/ene|2026/)
    })
  })

  describe('formatPhone', () => {
    it('returns empty for blank input', () => {
      expect(formatPhone('')).toBe('')
    })

    it('formats Spanish E.164 numbers', () => {
      expect(formatPhone('+34612345678')).toBe('+34 612 345 678')
    })

    it('returns original when pattern does not match', () => {
      expect(formatPhone('+1 555 0100')).toBe('+1 555 0100')
    })
  })
})
