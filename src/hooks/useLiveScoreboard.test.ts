/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react'

import { MUS_POINTS_PER_GAME, MUS_ROUND_TAP_POINTS, MUS_ROUNDS, TEAM } from '@/constants'
import { createDefaultScoreboardState, useLiveScoreboard } from '@/hooks/useLiveScoreboard'

jest.mock('@/lib/scoreboardStorage', () => ({
  loadScoreboardState: jest.fn().mockResolvedValue(null),
  saveScoreboardState: jest.fn().mockResolvedValue(undefined),
  clearScoreboardState: jest.fn().mockResolvedValue(undefined),
}))

import { loadScoreboardState, saveScoreboardState } from '@/lib/scoreboardStorage'

const mockLoad = loadScoreboardState as jest.Mock
const mockSave = saveScoreboardState as jest.Mock

describe('createDefaultScoreboardState', () => {
  it('returns zeroed points, games, and rounds', () => {
    const state = createDefaultScoreboardState()
    expect(state.pointsA).toBe(0)
    expect(state.pointsB).toBe(0)
    expect(state.gamesA).toBe(0)
    expect(state.gamesB).toBe(0)
    for (const round of MUS_ROUNDS) {
      expect(state.rounds[round]).toBe(0)
    }
  })
})

describe('useLiveScoreboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoad.mockResolvedValue(null)
  })

  it('waits for loaded before scoring actions matter', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(mockLoad).toHaveBeenCalledWith('match-1')
  })

  it('tapPairPoint at 40 awards a game and resets points', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      for (let i = 0; i < MUS_POINTS_PER_GAME; i++) {
        result.current.tapPairPoint(TEAM.A)
      }
    })

    expect(result.current.state.gamesA).toBe(1)
    expect(result.current.state.pointsA).toBe(0)
    expect(result.current.state.pointsB).toBe(0)
    expect(result.current.gameOver).toBeNull()
  })

  it('adjustPairPoints applies delta and closes game at 40', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.adjustPairPoints(TEAM.B, 39)
    })
    expect(result.current.state.pointsB).toBe(39)

    act(() => {
      result.current.adjustPairPoints(TEAM.B, 1)
    })
    expect(result.current.state.gamesB).toBe(1)
    expect(result.current.state.pointsB).toBe(0)
  })

  it('undo reverts the last scoring change', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.tapPairPoint(TEAM.A)
    })
    expect(result.current.state.pointsA).toBe(1)
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.state.pointsA).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it('sets gameOver when a team reaches durationTargetGames', async () => {
    const target = 2
    const { result } = renderHook(() => useLiveScoreboard('match-1', target))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      for (let g = 0; g < target; g++) {
        result.current.adjustPairPoints(TEAM.A, MUS_POINTS_PER_GAME)
      }
    })

    expect(result.current.state.gamesA).toBe(target)
    expect(result.current.gameOver).toEqual({
      team: TEAM.A,
      gamesA: target,
      gamesB: 0,
    })
  })

  it('tapRound adds MUS_ROUND_TAP_POINTS to the round counter', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.tapRound('grande')
    })

    expect(result.current.state.rounds.grande).toBe(MUS_ROUND_TAP_POINTS)
  })

  it('persists state after load', async () => {
    const { result } = renderHook(() => useLiveScoreboard('match-1', 3))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.tapPairPoint(TEAM.A)
    })

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
  })
})
