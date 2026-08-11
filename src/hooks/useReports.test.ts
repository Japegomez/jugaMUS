/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { useSubmitReport } from '@/hooks/useReports'

jest.mock('@/services/reports.service', () => ({
  submitReport: jest.fn(),
}))

import { submitReport } from '@/services/reports.service'

const mockSubmit = submitReport as jest.Mock

describe('useSubmitReport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    act(() => {
      useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
    })
  })

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ session: null })
    })
  })

  it('submits with reporterId from session', async () => {
    mockSubmit.mockResolvedValue(undefined)
    const { result } = renderHookWithClient(() => useSubmitReport())

    await act(async () => {
      await result.current.mutateAsync({
        targetType: 'user',
        targetId: 'u2',
        reason: 'Otro',
        notes: null,
      })
    })

    expect(mockSubmit).toHaveBeenCalledWith({
      targetType: 'user',
      targetId: 'u2',
      reason: 'Otro',
      notes: null,
      reporterId: 'user-1',
    })
  })

  it('rejects when not authenticated', async () => {
    act(() => {
      useAuthStore.setState({ session: null })
    })
    const { result } = renderHookWithClient(() => useSubmitReport())

    await expect(
      act(async () =>
        result.current.mutateAsync({
          targetType: 'match',
          targetId: 'm1',
          reason: 'Otro',
          notes: null,
        })
      )
    ).rejects.toThrow('No autenticado')

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
