import { validateMatchScores } from '@/components/matches/MatchScorePicker'

describe('validateMatchScores', () => {
  it('rejects ties', () => {
    expect(validateMatchScores(3, 3, 3)).toMatch(/empate/i)
  })

  it('requires winner to reach target', () => {
    expect(validateMatchScores(2, 1, 3)).toMatch(/ganador/i)
  })

  it('accepts valid scores', () => {
    expect(validateMatchScores(3, 1, 3)).toBeNull()
    expect(validateMatchScores(0, 3, 3)).toBeNull()
  })
})
