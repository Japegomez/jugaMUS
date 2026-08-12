/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { adminReportsQueryKey, useReportsList, useResolveReport } from '@/hooks/useAdmin'

jest.mock('@/services/admin.service', () => ({
  fetchAdminReports: jest.fn(),
  resolveReport: jest.fn(),
  fetchAdminFeedback: jest.fn(),
  blockUser: jest.fn(),
  deleteMatch: jest.fn(),
  deleteMatchResult: jest.fn(),
}))

import { fetchAdminReports, resolveReport } from '@/services/admin.service'

const mockFetchReports = fetchAdminReports as jest.Mock
const mockResolveReport = resolveReport as jest.Mock

describe('adminReportsQueryKey', () => {
  it('includes filters in key', () => {
    const filters = { status: 'open' as const }
    expect(adminReportsQueryKey(filters)).toEqual(['admin', 'reports', filters])
  })
})

describe('useReportsList', () => {
  it('loads admin reports', async () => {
    mockFetchReports.mockResolvedValue([])

    const { result } = renderHookWithClient(() => useReportsList({ status: 'open' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchReports).toHaveBeenCalledWith({ status: 'open' })
  })
})

describe('useResolveReport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'admin-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('invalidates reports on success', async () => {
    mockResolveReport.mockResolvedValue(undefined)

    const { result, queryClient } = renderHookWithClient(() => useResolveReport())
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ reportId: 'r1', actionTaken: 'dismissed' })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reports'] })
  })
})
