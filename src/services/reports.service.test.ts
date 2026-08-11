import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

import { REPORT_REASONS, submitReport } from '@/services/reports.service'

describe('reports.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
  })

  describe('REPORT_REASONS', () => {
    it('defines keys for match, user, and result', () => {
      expect(Object.keys(REPORT_REASONS)).toEqual(['match', 'user', 'result'])
      expect(REPORT_REASONS.match.length).toBeGreaterThan(0)
      expect(REPORT_REASONS.user.length).toBeGreaterThan(0)
      expect(REPORT_REASONS.result.length).toBeGreaterThan(0)
    })
  })

  describe('submitReport', () => {
    it('inserts report with trimmed notes', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      await submitReport({
        targetType: 'user',
        targetId: 'u2',
        reason: 'Comportamiento inapropiado',
        notes: '  detalle del incidente  ',
        reporterId: 'u1',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('reports')
    })

    it('stores null notes when blank after trim', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      await expect(
        submitReport({
          targetType: 'match',
          targetId: 'm1',
          reason: 'Otro',
          notes: '   ',
          reporterId: 'u1',
        })
      ).resolves.toBeUndefined()
    })

    it('throws on supabase error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'report insert failed' } })
      )

      await expect(
        submitReport({
          targetType: 'result',
          targetId: 'r1',
          reason: 'Resultado incorrecto',
          notes: null,
          reporterId: 'u1',
        })
      ).rejects.toThrow('report insert failed')
    })
  })
})
