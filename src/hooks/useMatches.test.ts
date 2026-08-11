/** @jest-environment jsdom */

import { waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { matchQueryKey, useMatch } from '@/hooks/useMatches'

jest.mock('@/services/matches.service', () => ({
  getMatch: jest.fn(),
}))

import { getMatch } from '@/services/matches.service'

const mockGetMatch = getMatch as jest.Mock

describe('matchQueryKey', () => {
  it('builds stable match query key', () => {
    expect(matchQueryKey('abc')).toEqual(['match', 'abc'])
  })
})

describe('useMatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: null })
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHookWithClient(() => useMatch(''))
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetMatch).not.toHaveBeenCalled()
  })

  it('fetches match when id is provided', async () => {
    const match = { id: 'm1', title: 'Partida' }
    mockGetMatch.mockResolvedValue(match)

    const { result } = renderHookWithClient(() => useMatch('m1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(match)
    expect(mockGetMatch).toHaveBeenCalledWith('m1')
  })
})
