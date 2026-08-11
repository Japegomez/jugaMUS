import {
  AUTO_CANCEL_NO_BRACKET_ALERT,
  DEFAULT_TOURNAMENT_CITY,
  DEFAULT_TOURNAMENT_TITLE,
  entryFeeToFormValue,
  formatEntryFee,
  tournamentPlacePayload,
} from '@/utils/tournamentForm'

describe('tournamentForm (beyond entry fee)', () => {
  it('exports defaults and auto-cancel alert copy', () => {
    expect(DEFAULT_TOURNAMENT_TITLE).toBe('Torneo')
    expect(DEFAULT_TOURNAMENT_CITY).toBe('Ciudad por definir')
    expect(AUTO_CANCEL_NO_BRACKET_ALERT.message).toContain('cuadro')
  })

  describe('tournamentPlacePayload', () => {
    it('marks place defined when text is present', () => {
      expect(tournamentPlacePayload('  Sala  ')).toEqual({
        place_defined: true,
        place_text: 'Sala',
      })
    })

    it('marks undefined when text is empty', () => {
      expect(tournamentPlacePayload('')).toEqual({
        place_defined: false,
        place_text: null,
      })
    })
  })

  describe('formatEntryFee / entryFeeToFormValue', () => {
    it('formats EUR currency', () => {
      expect(formatEntryFee(10)).toMatch(/10/)
      expect(formatEntryFee(10.5)).toMatch(/10,50|10\.50/)
    })

    it('coerces form values', () => {
      expect(entryFeeToFormValue(null)).toBe('0')
      expect(entryFeeToFormValue(5)).toBe('5')
      expect(entryFeeToFormValue(7.5)).toBe('7.5')
    })
  })
})
