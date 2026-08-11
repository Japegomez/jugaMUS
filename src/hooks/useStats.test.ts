/** @jest-environment jsdom */

import { waitFor } from '@testing-library/react'

import { renderHookWithClient } from '@/__test-utils__/renderHook'
import {
  leaderboardQueryKey,
  playerStatsQueryKey,
  useLeaderboard,
  usePlayerStats,
} from '@/hooks/useStats'

jest.mock('@/services/stats.service', () => ({
  getPlayerStats: jest.fn(),
  getLeaderboard: jest.fn(),
  getMatchInsights: jest.fn(),
  getPlayerRanking: jest.fn(),
}))

import { getLeaderboard, getPlayerStats } from '@/services/stats.service'

const mockGetPlayerStats = getPlayerStats as jest.Mock
const mockGetLeaderboard = getLeaderboard as jest.Mock

describe('stats query keys', () => {
  it('builds player stats key', () => {
    expect(playerStatsQueryKey('u1')).toEqual(['player-stats', 'u1'])
  })

  it('normalizes leaderboard city', () => {
    expect(leaderboardQueryKey('  Madrid  ')).toEqual(['leaderboard', 'Madrid'])
    expect(leaderboardQueryKey(null)).toEqual(['leaderboard', 'all'])
  })
})

describe('usePlayerStats', () => {
  it('fetches stats when userId is set', async () => {
    mockGetPlayerStats.mockResolvedValue({ badges: [], wins: 0 })

    const { result } = renderHookWithClient(() => usePlayerStats('u1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetPlayerStats).toHaveBeenCalledWith('u1')
  })

  it('is disabled without userId', () => {
    const { result } = renderHookWithClient(() => usePlayerStats(null))
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useLeaderboard', () => {
  it('fetches leaderboard', async () => {
    mockGetLeaderboard.mockResolvedValue([])

    const { result } = renderHookWithClient(() => useLeaderboard('Madrid'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetLeaderboard).toHaveBeenCalledWith('Madrid')
  })
})
