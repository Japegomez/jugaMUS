import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

import { feedbackCategoryLabel, submitFeedback } from '@/services/feedback.service'

describe('feedback.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
  })

  describe('feedbackCategoryLabel', () => {
    it('returns label for known categories', () => {
      expect(feedbackCategoryLabel('issue')).toBe('Problema o error')
      expect(feedbackCategoryLabel('feature')).toBe('Sugerencia de función')
      expect(feedbackCategoryLabel('other')).toBe('Otro')
    })

    it('returns raw value for unknown category', () => {
      expect(feedbackCategoryLabel('unknown')).toBe('unknown')
    })
  })

  describe('submitFeedback', () => {
    it('rejects message shorter than 10 chars', async () => {
      await expect(
        submitFeedback({ userId: 'u1', category: 'issue', message: '  corto  ' })
      ).rejects.toThrow('El mensaje debe tener al menos 10 caracteres')

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('trims message and inserts', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: null }))

      await submitFeedback({
        userId: 'u1',
        category: 'feature',
        message: '  Esto es un mensaje válido  ',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      const insertChain = mockSupabase.from.mock.results[0].value
      await insertChain.insert({
        user_id: 'u1',
        category: 'feature',
        message: 'Esto es un mensaje válido',
      })
    })

    it('throws on supabase error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'insert failed' } })
      )

      await expect(
        submitFeedback({
          userId: 'u1',
          category: 'other',
          message: 'Mensaje suficientemente largo',
        })
      ).rejects.toThrow('insert failed')
    })

    it('throws fallback message when error has no message', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: null, error: { message: '' } }))

      await expect(
        submitFeedback({
          userId: 'u1',
          category: 'other',
          message: 'Mensaje suficientemente largo',
        })
      ).rejects.toThrow('No se pudo enviar el feedback')
    })
  })
})
