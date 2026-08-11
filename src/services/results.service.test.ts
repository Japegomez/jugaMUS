import { RESULT_STATUS } from '@/constants'
import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

jest.mock('@/lib/analytics', () => ({
  trackMatchCompletedIfFinished: jest.fn().mockResolvedValue(undefined),
}))

import { trackMatchCompletedIfFinished } from '@/lib/analytics'
import {
  fetchMatchResultBundle,
  mapResultRpcError,
  submitConfirmation,
  submitResult,
} from '@/services/results.service'

describe('results.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
  })

  describe('mapResultRpcError', () => {
    it('maps tie_not_allowed', () => {
      expect(mapResultRpcError('error: tie_not_allowed')).toBe('No puede haber empate.')
    })

    it('maps winner_must_reach_target', () => {
      expect(mapResultRpcError('winner_must_reach_target')).toBe(
        'El ganador debe alcanzar el número de juegos configurado en la partida.'
      )
    })

    it('maps invalid_scores', () => {
      expect(mapResultRpcError('invalid_scores in payload')).toBe('Marcador no válido.')
    })

    it('maps result_already_exists', () => {
      expect(mapResultRpcError('result_already_exists')).toBe(
        'Ya hay un resultado registrado para esta partida.'
      )
    })

    it('passes through unknown messages', () => {
      expect(mapResultRpcError('custom db error')).toBe('custom db error')
    })
  })

  describe('fetchMatchResultBundle', () => {
    it('returns null result when no rows', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: [], error: null }))

      const bundle = await fetchMatchResultBundle('m1')
      expect(bundle).toEqual({ result: null, myConfirmation: null })
    })

    it('returns result without confirmation when no viewerUserId', async () => {
      const resultRow = { id: 'r1', match_id: 'm1', status: RESULT_STATUS.PENDING_VALIDATION }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: [resultRow], error: null }))

      const bundle = await fetchMatchResultBundle('m1')
      expect(bundle.result).toEqual(resultRow)
      expect(bundle.myConfirmation).toBeNull()
    })

    it('returns result with viewer confirmation', async () => {
      const resultRow = { id: 'r1', match_id: 'm1', status: RESULT_STATUS.PENDING_VALIDATION }
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'match_results') {
          return mockFromChain({ data: [resultRow], error: null })
        }
        if (table === 'result_confirmations') {
          return mockFromChain({ data: { decision: 'approve' }, error: null })
        }
        return mockFromChain({ data: null, error: null })
      })

      const bundle = await fetchMatchResultBundle('m1', 'u1')
      expect(bundle.result).toEqual(resultRow)
      expect(bundle.myConfirmation).toEqual({ decision: 'approve' })
    })

    it('throws on match_results query error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'db fail' } })
      )

      await expect(fetchMatchResultBundle('m1')).rejects.toThrow('db fail')
    })

    it('throws on confirmation query error', async () => {
      const resultRow = { id: 'r1', match_id: 'm1' }
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'match_results') {
          return mockFromChain({ data: [resultRow], error: null })
        }
        return mockFromChain({ data: null, error: { message: 'conf err' } })
      })

      await expect(fetchMatchResultBundle('m1', 'u1')).rejects.toThrow('conf err')
    })
  })

  describe('submitResult', () => {
    it('maps RPC errors via mapResultRpcError', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'invalid_scores' } })

      await expect(
        submitResult({
          matchId: 'm1',
          submittedByUserId: 'u1',
          submittedByTeam: 'A',
          teamAGames: 3,
          teamBGames: 1,
        })
      ).rejects.toThrow('Marcador no válido.')
    })

    it('throws when RPC returns no data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await expect(
        submitResult({
          matchId: 'm1',
          submittedByUserId: 'u1',
          submittedByTeam: 'A',
          teamAGames: 3,
          teamBGames: 1,
        })
      ).rejects.toThrow('No se pudo registrar el resultado')
    })

    it('tracks completion when status is CONFIRMED', async () => {
      const row = { id: 'r1', match_id: 'm1', status: RESULT_STATUS.CONFIRMED }
      mockSupabase.rpc.mockResolvedValue({ data: row, error: null })

      const result = await submitResult({
        matchId: 'm1',
        submittedByUserId: 'u1',
        submittedByTeam: 'A',
        teamAGames: 3,
        teamBGames: 1,
      })

      expect(result).toEqual(row)
      expect(trackMatchCompletedIfFinished).toHaveBeenCalledWith('m1')
    })

    it('does not track completion when status is pending', async () => {
      const row = { id: 'r1', match_id: 'm1', status: RESULT_STATUS.PENDING_VALIDATION }
      mockSupabase.rpc.mockResolvedValue({ data: row, error: null })

      await submitResult({
        matchId: 'm1',
        submittedByUserId: 'u1',
        submittedByTeam: 'A',
        teamAGames: 3,
        teamBGames: 1,
      })

      expect(trackMatchCompletedIfFinished).not.toHaveBeenCalled()
    })
  })

  describe('submitConfirmation', () => {
    it('throws on duplicate confirmation (23505)', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { code: '23505', message: 'duplicate' } })
      )

      await expect(
        submitConfirmation({
          matchId: 'm1',
          matchResultId: 'r1',
          userId: 'u1',
          team: 'B',
          decision: 'approve',
        })
      ).rejects.toThrow('Ya has respondido a este resultado.')
    })

    it('tracks analytics on approve', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      await submitConfirmation({
        matchId: 'm1',
        matchResultId: 'r1',
        userId: 'u1',
        team: 'B',
        decision: 'approve',
      })

      expect(trackMatchCompletedIfFinished).toHaveBeenCalledWith('m1')
    })

    it('does not track analytics on dispute', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      await submitConfirmation({
        matchId: 'm1',
        matchResultId: 'r1',
        userId: 'u1',
        team: 'B',
        decision: 'dispute',
      })

      expect(trackMatchCompletedIfFinished).not.toHaveBeenCalled()
    })
  })
})
