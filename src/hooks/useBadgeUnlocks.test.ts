/** @jest-environment jsdom */

import { act, waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import { useAuthStore } from '@/hooks/useAuth'
import { useBadgeUnlocks } from '@/hooks/useBadgeUnlocks'

jest.mock('@/hooks/useStats', () => ({
  usePlayerStats: jest.fn(),
}))

import { usePlayerStats } from '@/hooks/useStats'

const mockUsePlayerStats = usePlayerStats as jest.Mock

describe('useBadgeUnlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never })
  })

  afterEach(() => {
    useAuthStore.setState({ session: null })
  })

  it('does not celebrate badges on first stats load', () => {
    mockUsePlayerStats.mockReturnValue({
      data: { badges: [{ key: 'first_win', emoji: '🏆' }] },
    })

    const { result } = renderHookWithClient(() => useBadgeUnlocks())

    expect(result.current.unlockedBadge).toBeNull()
  })

  it('queues newly earned badges after initial load', async () => {
    mockUsePlayerStats.mockReturnValue({ data: undefined })

    const { result, rerender } = renderHookWithClient(() => useBadgeUnlocks())

    mockUsePlayerStats.mockReturnValue({
      data: { badges: [{ key: 'first_win' }] },
    })
    rerender()

    expect(result.current.unlockedBadge).toBeNull()

    mockUsePlayerStats.mockReturnValue({
      data: {
        badges: [{ key: 'first_win' }, { key: 'wins_10' }],
      },
    })
    rerender()

    await waitFor(() => {
      expect(result.current.unlockedBadge).toEqual({ key: 'wins_10', emoji: '🔟' })
    })
  })

  it('dismiss advances the unlock queue', async () => {
    mockUsePlayerStats.mockReturnValue({
      data: { badges: [{ key: 'a' }] },
    })

    const { result, rerender } = renderHookWithClient(() => useBadgeUnlocks())

    mockUsePlayerStats.mockReturnValue({
      data: { badges: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
    })
    rerender()

    await waitFor(() => expect(result.current.unlockedBadge?.key).toBe('b'))

    act(() => {
      result.current.dismiss()
    })

    await waitFor(() => expect(result.current.unlockedBadge?.key).toBe('c'))
  })
})
