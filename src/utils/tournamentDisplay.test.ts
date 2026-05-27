import { TOURNAMENT_STATUS } from '@/constants'
import { tournamentStatusDisplay } from '@/utils/tournamentDisplay'

describe('tournamentStatusDisplay', () => {
  it('maps tournament status to display labels', () => {
    expect(tournamentStatusDisplay({ status: TOURNAMENT_STATUS.REGISTRATION }).text).toBe(
      'Planificado'
    )
    expect(tournamentStatusDisplay({ status: TOURNAMENT_STATUS.IN_PROGRESS }).text).toBe('En curso')
    expect(tournamentStatusDisplay({ status: TOURNAMENT_STATUS.FINISHED }).text).toBe('Finalizado')
    expect(tournamentStatusDisplay({ status: TOURNAMENT_STATUS.CANCELLED }).text).toBe('Cancelado')
  })
})
