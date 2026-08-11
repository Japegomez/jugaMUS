/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { tournamentQueryKey, useCreateTournament, useTournament } from '@/hooks/useTournaments'

jest.mock('@/services/tournaments.service', () => ({
  getTournament: jest.fn(),
  createTournament: jest.fn(),
}))

import { createTournament, getTournament } from '@/services/tournaments.service'

const mockGetTournament = getTournament as jest.Mock
const mockCreateTournament = createTournament as jest.Mock

describe('tournamentQueryKey', () => {
  it('builds tournament key', () => {
    expect(tournamentQueryKey('t1')).toEqual(['tournament', 't1'])
  })
})

describe('useTournament', () => {
  it('fetches tournament by id', async () => {
    const row = { id: 't1', title: 'Torneo' }
    mockGetTournament.mockResolvedValue(row)

    const { result } = renderHookWithClient(() => useTournament('t1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(row)
  })
})

describe('useCreateTournament', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('requires authentication', async () => {
    useAuthStore.setState({ session: null })
    const { result } = renderHookWithClient(() => useCreateTournament())

    await expect(result.current.mutateAsync({ data: { title: 'X' } as never })).rejects.toThrow(
      'No autenticado'
    )
  })

  it('invalidates tournament query on success', async () => {
    const row = { id: 't-new', title: 'Nuevo' }
    mockCreateTournament.mockResolvedValue(row)

    const { result, queryClient } = renderHookWithClient(() => useCreateTournament())
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ data: { title: 'Nuevo' } as never })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tournamentQueryKey('t-new') })
  })
})
