import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MUS_DEFAULT_BET, MUS_PHASES, MUS_POINTS_PER_GAME, type MusPhase } from '@/constants'
import { TEAM } from '@/constants'
import {
  clearScoreboardState,
  loadScoreboardState,
  saveScoreboardState,
} from '@/lib/scoreboardStorage'

export type TeamId = typeof TEAM.A | typeof TEAM.B

export type PhaseState = {
  bet: number
  winner: TeamId | null
}

export type LiveScoreboardState = {
  pointsA: number
  pointsB: number
  gamesA: number
  gamesB: number
  phases: Record<MusPhase, PhaseState>
}

export type GameOverResult = {
  team: TeamId
  gamesA: number
  gamesB: number
}

function createDefaultPhases(): Record<MusPhase, PhaseState> {
  return MUS_PHASES.reduce(
    (acc, phase) => {
      acc[phase] = { bet: MUS_DEFAULT_BET, winner: null }
      return acc
    },
    {} as Record<MusPhase, PhaseState>
  )
}

export function createDefaultScoreboardState(): LiveScoreboardState {
  return {
    pointsA: 0,
    pointsB: 0,
    gamesA: 0,
    gamesB: 0,
    phases: createDefaultPhases(),
  }
}

function allPhasesHaveWinner(phases: Record<MusPhase, PhaseState>): boolean {
  return MUS_PHASES.every((phase) => phases[phase].winner !== null)
}

function applyGameWin(
  state: LiveScoreboardState,
  team: TeamId
): { state: LiveScoreboardState; gameOver: GameOverResult | null } {
  const next: LiveScoreboardState = {
    ...state,
    pointsA: 0,
    pointsB: 0,
    gamesA: team === TEAM.A ? state.gamesA + 1 : state.gamesA,
    gamesB: team === TEAM.B ? state.gamesB + 1 : state.gamesB,
    phases: createDefaultPhases(),
  }

  return {
    state: next,
    gameOver: null,
  }
}

function settlePhases(state: LiveScoreboardState): LiveScoreboardState {
  let pointsA = state.pointsA
  let pointsB = state.pointsB

  for (const phase of MUS_PHASES) {
    const { bet, winner } = state.phases[phase]
    if (winner === TEAM.A) pointsA += bet
    else if (winner === TEAM.B) pointsB += bet
  }

  let next: LiveScoreboardState = {
    ...state,
    pointsA,
    pointsB,
    phases: createDefaultPhases(),
  }

  if (pointsA >= MUS_POINTS_PER_GAME) {
    const result = applyGameWin(next, TEAM.A)
    next = result.state
  } else if (pointsB >= MUS_POINTS_PER_GAME) {
    const result = applyGameWin(next, TEAM.B)
    next = result.state
  }

  return next
}

function checkGameOver(
  state: LiveScoreboardState,
  durationTargetGames: number
): GameOverResult | null {
  if (state.gamesA >= durationTargetGames) {
    return { team: TEAM.A, gamesA: state.gamesA, gamesB: state.gamesB }
  }
  if (state.gamesB >= durationTargetGames) {
    return { team: TEAM.B, gamesA: state.gamesA, gamesB: state.gamesB }
  }
  return null
}

export function useLiveScoreboard(matchId: string, durationTargetGames: number) {
  const [state, setState] = useState<LiveScoreboardState>(createDefaultScoreboardState)
  const [loaded, setLoaded] = useState(false)
  const [gameOver, setGameOver] = useState<GameOverResult | null>(null)
  const skipPersistRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadScoreboardState(matchId)
      if (cancelled) return
      if (saved) {
        setState(saved)
        const over = checkGameOver(saved, durationTargetGames)
        if (over) setGameOver(over)
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [matchId, durationTargetGames])

  useEffect(() => {
    if (!loaded || skipPersistRef.current) return
    void saveScoreboardState(matchId, state)
  }, [matchId, state, loaded])

  const updateState = useCallback(
    (updater: (prev: LiveScoreboardState) => LiveScoreboardState) => {
      setState((prev) => {
        const next = updater(prev)
        const over = checkGameOver(next, durationTargetGames)
        setGameOver(over)
        return next
      })
    },
    [durationTargetGames]
  )

  const addPoints = useCallback(
    (team: TeamId, amount: number) => {
      updateState((prev) => {
        const next =
          team === TEAM.A
            ? { ...prev, pointsA: prev.pointsA + amount }
            : { ...prev, pointsB: prev.pointsB + amount }

        if (next.pointsA >= MUS_POINTS_PER_GAME) return applyGameWin(next, TEAM.A).state
        if (next.pointsB >= MUS_POINTS_PER_GAME) return applyGameWin(next, TEAM.B).state
        return next
      })
    },
    [updateState]
  )

  const subtractPoints = useCallback(
    (team: TeamId, amount: number) => {
      updateState((prev) =>
        team === TEAM.A
          ? { ...prev, pointsA: Math.max(0, prev.pointsA - amount) }
          : { ...prev, pointsB: Math.max(0, prev.pointsB - amount) }
      )
    },
    [updateState]
  )

  const adjustGames = useCallback(
    (team: TeamId, delta: number) => {
      updateState((prev) => {
        const next =
          team === TEAM.A
            ? { ...prev, gamesA: Math.max(0, prev.gamesA + delta) }
            : { ...prev, gamesB: Math.max(0, prev.gamesB + delta) }
        return next
      })
    },
    [updateState]
  )

  const adjustBet = useCallback(
    (phase: MusPhase, delta: number) => {
      updateState((prev) => {
        const current = prev.phases[phase]
        const bet = Math.max(1, current.bet + delta)
        return {
          ...prev,
          phases: {
            ...prev.phases,
            [phase]: { ...current, bet },
          },
        }
      })
    },
    [updateState]
  )

  const setPhaseWinner = useCallback(
    (phase: MusPhase, team: TeamId) => {
      updateState((prev) => {
        const current = prev.phases[phase]
        const winner = current.winner === team ? null : team
        const phases = {
          ...prev.phases,
          [phase]: { ...current, winner },
        }

        if (!allPhasesHaveWinner(phases)) {
          return { ...prev, phases }
        }

        return settlePhases({ ...prev, phases })
      })
    },
    [updateState]
  )

  const awardOrdago = useCallback(
    (team: TeamId) => {
      updateState((prev) => applyGameWin(prev, team).state)
    },
    [updateState]
  )

  const reset = useCallback(async () => {
    skipPersistRef.current = true
    const fresh = createDefaultScoreboardState()
    setState(fresh)
    setGameOver(null)
    await clearScoreboardState(matchId)
    skipPersistRef.current = false
  }, [matchId])

  const dismissGameOver = useCallback(() => {
    setGameOver(null)
  }, [])

  const canSettle = useMemo(() => allPhasesHaveWinner(state.phases), [state.phases])

  return {
    state,
    loaded,
    gameOver,
    canSettle,
    addPoints,
    subtractPoints,
    adjustGames,
    adjustBet,
    setPhaseWinner,
    awardOrdago,
    reset,
    dismissGameOver,
  }
}
