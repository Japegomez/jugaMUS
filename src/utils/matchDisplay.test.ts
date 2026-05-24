import { MATCH_STATUS } from '@/constants'
import { matchStatusDisplay } from '@/utils/matchDisplay'

describe('matchDisplay', () => {
  it('maps match status to display labels', () => {
    expect(matchStatusDisplay({ status: MATCH_STATUS.PLANNED }).text).toBe('Planificada')
    expect(matchStatusDisplay({ status: MATCH_STATUS.IN_PROGRESS }).text).toBe('En curso')
    expect(matchStatusDisplay({ status: MATCH_STATUS.CANCELLED }).text).toBe('Cancelada')
  })
})
