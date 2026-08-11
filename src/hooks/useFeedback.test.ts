/** @jest-environment jsdom */

import { act } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { useSubmitFeedback } from '@/hooks/useFeedback'

jest.mock('@/services/feedback.service', () => ({
  submitFeedback: jest.fn(),
}))

import { submitFeedback } from '@/services/feedback.service'

const mockSubmitFeedback = submitFeedback as jest.Mock

describe('useSubmitFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('requires authentication', async () => {
    useAuthStore.setState({ session: null })
    const { result } = renderHookWithClient(() => useSubmitFeedback())

    await expect(
      result.current.mutateAsync({ category: 'bug', message: 'Algo falla' })
    ).rejects.toThrow('No autenticado')
  })

  it('submits feedback with session user id', async () => {
    mockSubmitFeedback.mockResolvedValue(undefined)

    const { result } = renderHookWithClient(() => useSubmitFeedback())

    await act(async () => {
      await result.current.mutateAsync({ category: 'idea', message: 'Me gustaría X' })
    })

    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      category: 'idea',
      message: 'Me gustaría X',
      userId: 'user-1',
    })
  })
})
