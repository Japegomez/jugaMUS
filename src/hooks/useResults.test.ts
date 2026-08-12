/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { matchQueryKey, matchResultQueryKey } from '@/hooks/useMatches'
import { useAuthStore } from '@/hooks/useAuth'
import { useMatchResult, useSubmitResult } from '@/hooks/useResults'

jest.mock('@/services/results.service', () => ({
  fetchMatchResultBundle: jest.fn(),
  submitResult: jest.fn(),
}))

import { fetchMatchResultBundle, submitResult } from '@/services/results.service'

const mockFetch = fetchMatchResultBundle as jest.Mock
const mockSubmit = submitResult as jest.Mock

describe('useMatchResult', () => {
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

  it('uses matchResultQueryKey with viewer id', async () => {
    const bundle = { result: null, viewerConfirmation: null }
    mockFetch.mockResolvedValue(bundle)

    const { result } = renderHookWithClient(() => useMatchResult('m1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('m1', 'user-1')
    expect(matchResultQueryKey('m1', 'user-1')).toEqual(['match', 'm1', 'match_result', 'user-1'])
  })

  it('is disabled without session', () => {
    act(() => {
      useAuthStore.setState({ session: null })
    })
    const { result } = renderHookWithClient(() => useMatchResult('m1'))
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useSubmitResult', () => {
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

  it('invalidates match and result queries on success', async () => {
    mockSubmit.mockResolvedValue({ status: 'pending' })

    const { result, queryClient } = renderHookWithClient(() => useSubmitResult())
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({
        matchId: 'm1',
        teamAGames: 2,
        teamBGames: 1,
      } as never)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: matchQueryKey('m1') })
  })
})
