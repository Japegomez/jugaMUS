import { LEAGUE_FORMAT, LEAGUE_STATUS } from '@/constants'
import {
  isOpenEloFormat,
  isRoundRobinFormat,
  leagueFormatDisplay,
  leagueStatusDisplay,
} from '@/utils/leagueDisplay'

describe('leagueDisplay', () => {
  it('maps status labels', () => {
    expect(leagueStatusDisplay({ status: LEAGUE_STATUS.REGISTRATION }).text).toBe('Inscripción')
    expect(leagueStatusDisplay({ status: LEAGUE_STATUS.IN_PROGRESS }).text).toBe('En curso')
    expect(leagueStatusDisplay({ status: LEAGUE_STATUS.FINISHED }).text).toBe('Finalizada')
    expect(leagueStatusDisplay({ status: LEAGUE_STATUS.CANCELLED }).text).toBe('Cancelada')
  })

  it('maps format labels', () => {
    expect(leagueFormatDisplay(LEAGUE_FORMAT.SINGLE_ROUND)).toBe('Solo ida')
    expect(leagueFormatDisplay(LEAGUE_FORMAT.DOUBLE_ROUND)).toBe('Ida y vuelta')
    expect(leagueFormatDisplay(LEAGUE_FORMAT.OPEN_ELO)).toBe('Liga abierta')
  })

  it('detects format kinds', () => {
    expect(isRoundRobinFormat(LEAGUE_FORMAT.SINGLE_ROUND)).toBe(true)
    expect(isRoundRobinFormat(LEAGUE_FORMAT.OPEN_ELO)).toBe(false)
    expect(isOpenEloFormat(LEAGUE_FORMAT.OPEN_ELO)).toBe(true)
  })
})
