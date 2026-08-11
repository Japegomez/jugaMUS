import {
  AUTO_START_LEAGUE_ALERT,
  DEFAULT_LEAGUE_CITY,
  DEFAULT_LEAGUE_TITLE,
  leaguePlacePayload,
} from '@/utils/leagueForm'

describe('leagueForm', () => {
  it('exports defaults and start alert', () => {
    expect(DEFAULT_LEAGUE_TITLE).toBe('Liga')
    expect(DEFAULT_LEAGUE_CITY).toBe('Ciudad por definir')
    expect(AUTO_START_LEAGUE_ALERT.message).toContain('Iniciar liga')
  })

  describe('leaguePlacePayload', () => {
    it('returns undefined place when text empty', () => {
      expect(leaguePlacePayload('')).toEqual({
        place_defined: false,
        place_text: null,
      })
    })

    it('trims and marks defined when text provided', () => {
      expect(leaguePlacePayload('  Peña Mus  ')).toEqual({
        place_defined: true,
        place_text: 'Peña Mus',
      })
    })
  })
})
