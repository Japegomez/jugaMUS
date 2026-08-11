/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { leagueQueryKey, useCreateLeague, useLeague } from '@/hooks/useLeagues'

jest.mock('@/services/leagues.service', () => ({
  getLeague: jest.fn(),
  createLeague: jest.fn(),
}))

import { createLeague, getLeague } from '@/services/leagues.service'

const mockGetLeague = getLeague as jest.Mock
const mockCreateLeague = createLeague as jest.Mock

describe('leagueQueryKey', () => {
  it('builds league key', () => {
    expect(leagueQueryKey('l1')).toEqual(['league', 'l1'])
  })
})

describe('useLeague', () => {
  it('fetches league when id is set', async () => {
    const row = { id: 'l1', title: 'Liga' }
    mockGetLeague.mockResolvedValue(row)

    const { result } = renderHookWithClient(() => useLeague('l1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(row)
  })
})

describe('useCreateLeague', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('invalidates league query on success', async () => {
    const row = { id: 'l-new', title: 'Nueva liga' }
    mockCreateLeague.mockResolvedValue(row)

    const { result, queryClient } = renderHookWithClient(() => useCreateLeague())
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ data: { title: 'Nueva liga' } as never })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: leagueQueryKey('l-new') })
  })
})
