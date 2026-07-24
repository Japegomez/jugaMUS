import { useCallback, useEffect, useRef, useState } from 'react'

import { MUS_POINTS_PER_GAME, MUS_ROUNDS, MUS_ROUND_TAP_POINTS, TEAM } from '@/constants'
import type { MusRound } from '@/constants'
import {
  loadScoreboardState,
  saveScoreboardState,
  clearScoreboardState,
} from '@/lib/scoreboardStorage'

export type TeamId = typeof TEAM.A | typeof TEAM.B

export type LiveScoreboardState = {
  pointsA: number
  pointsB: number
  gamesA: number
  gamesB: number
  rounds: Record<MusRound, number>
}

export type GameOverResult = {
  team: TeamId
  gamesA: number
  gamesB: number
}

/** Máximo de pasos que se pueden deshacer. */
const HISTORY_LIMIT = 100

function createDefaultRounds(): Record<MusRound, number> {
  return MUS_ROUNDS.reduce(
    (acc, round) => {
      acc[round] = 0
      return acc
    },
    {} as Record<MusRound, number>
  )
}

export function createDefaultScoreboardState(): LiveScoreboardState {
  return {
    pointsA: 0,
    pointsB: 0,
    gamesA: 0,
    gamesB: 0,
    rounds: createDefaultRounds(),
  }
}

/** Valida que el estado persistido tenga la forma actual (con `rounds`). */
function isValidState(value: unknown): value is LiveScoreboardState {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<LiveScoreboardState>
  return (
    typeof s.pointsA === 'number' &&
    typeof s.pointsB === 'number' &&
    typeof s.gamesA === 'number' &&
    typeof s.gamesB === 'number' &&
    !!s.rounds &&
    MUS_ROUNDS.every((r) => typeof s.rounds?.[r] === 'number')
  )
}

/** Inicia un juego nuevo: suma un juego a la pareja y resetea puntos y rondas. */
function startNewGame(state: LiveScoreboardState, team: TeamId): LiveScoreboardState {
  return {
    ...state,
    pointsA: 0,
    pointsB: 0,
    gamesA: team === TEAM.A ? state.gamesA + 1 : state.gamesA,
    gamesB: team === TEAM.B ? state.gamesB + 1 : state.gamesB,
    rounds: createDefaultRounds(),
  }
}

/** Aplica un nuevo total de puntos a una pareja; si llega a 40, cierra el juego. */
function withPairPoints(
  state: LiveScoreboardState,
  team: TeamId,
  nextPoints: number
): LiveScoreboardState {
  const clamped = Math.max(0, nextPoints)
  const current = team === TEAM.A ? state.pointsA : state.pointsB
  if (clamped === current) return state

  const updated: LiveScoreboardState =
    team === TEAM.A ? { ...state, pointsA: clamped } : { ...state, pointsB: clamped }

  if (clamped >= MUS_POINTS_PER_GAME) {
    return startNewGame(updated, team)
  }
  return updated
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
  const [canUndo, setCanUndo] = useState(false)

  const stateRef = useRef(state)
  const historyRef = useRef<LiveScoreboardState[]>([])
  const skipPersistRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadScoreboardState(matchId)
      if (cancelled) return
      if (saved && isValidState(saved)) {
        stateRef.current = saved
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

  /** Aplica un cambio guardando el estado anterior en el historial de deshacer. */
  const commit = useCallback(
    (compute: (prev: LiveScoreboardState) => LiveScoreboardState) => {
      const prev = stateRef.current
      const next = compute(prev)
      if (next === prev) return

      historyRef.current.push(prev)
      if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift()
      setCanUndo(true)

      stateRef.current = next
      setState(next)
      setGameOver(checkGameOver(next, durationTargetGames))
    },
    [durationTargetGames]
  )

  /** Suma 1 punto (toque sobre el cuadro blanco). */
  const tapPairPoint = useCallback(
    (team: TeamId) => {
      commit((prev) =>
        withPairPoints(prev, team, (team === TEAM.A ? prev.pointsA : prev.pointsB) + 1)
      )
    },
    [commit]
  )

  /** Ajuste manual de puntos de una pareja (−1, +1, +5). */
  const adjustPairPoints = useCallback(
    (team: TeamId, delta: number) => {
      commit((prev) =>
        withPairPoints(prev, team, (team === TEAM.A ? prev.pointsA : prev.pointsB) + delta)
      )
    },
    [commit]
  )

  /** Toque sobre el contador central de ronda: suma 2 puntos. */
  const tapRound = useCallback(
    (round: MusRound) => {
      commit((prev) => {
        const nextValue = prev.rounds[round] + MUS_ROUND_TAP_POINTS
        if (nextValue === prev.rounds[round]) return prev
        return {
          ...prev,
          rounds: { ...prev.rounds, [round]: nextValue },
        }
      })
    },
    [commit]
  )

  /** Ajuste manual del contador de ronda (+1, +5). */
  const adjustRound = useCallback(
    (round: MusRound, delta: number) => {
      commit((prev) => {
        const nextValue = Math.max(0, prev.rounds[round] + delta)
        if (nextValue === prev.rounds[round]) return prev
        return {
          ...prev,
          rounds: { ...prev.rounds, [round]: nextValue },
        }
      })
    },
    [commit]
  )

  /** Vuelca los puntos de una ronda a una pareja (flecha izquierda/derecha). */
  const awardRound = useCallback(
    (round: MusRound, team: TeamId) => {
      commit((prev) => {
        const amount = prev.rounds[round]
        if (amount <= 0) return prev
        const cleared: LiveScoreboardState = {
          ...prev,
          rounds: { ...prev.rounds, [round]: 0 },
        }
        return withPairPoints(
          cleared,
          team,
          (team === TEAM.A ? cleared.pointsA : cleared.pointsB) + amount
        )
      })
    },
    [commit]
  )

  /** Ajuste manual de juegos. Al sumar un juego se resetean los puntos. */
  const adjustGames = useCallback(
    (team: TeamId, delta: number) => {
      commit((prev) => {
        if (delta > 0) return startNewGame(prev, team)
        return team === TEAM.A
          ? { ...prev, gamesA: Math.max(0, prev.gamesA - 1) }
          : { ...prev, gamesB: Math.max(0, prev.gamesB - 1) }
      })
    },
    [commit]
  )

  const undo = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return
    const prevState = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    setCanUndo(historyRef.current.length > 0)
    stateRef.current = prevState
    setState(prevState)
    setGameOver(checkGameOver(prevState, durationTargetGames))
  }, [durationTargetGames])

  const dismissGameOver = useCallback(() => {
    setGameOver(null)
  }, [])

  /** Reinicia el marcador en memoria y en almacenamiento (p. ej. tras ir a registrar resultado). */
  const resetBoard = useCallback(async () => {
    skipPersistRef.current = true
    const fresh = createDefaultScoreboardState()
    historyRef.current = []
    stateRef.current = fresh
    setState(fresh)
    setGameOver(null)
    setCanUndo(false)
    try {
      await clearScoreboardState(matchId)
    } catch {
      // Best-effort local cleanup; in-memory reset already applied.
    } finally {
      skipPersistRef.current = false
    }
  }, [matchId])

  return {
    state,
    loaded,
    gameOver,
    canUndo,
    tapPairPoint,
    adjustPairPoints,
    tapRound,
    adjustRound,
    awardRound,
    adjustGames,
    undo,
    dismissGameOver,
    resetBoard,
  }
}
