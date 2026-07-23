import { useCallback, useMemo } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'

import { ScoreboardBoard } from '@/components/matches/ScoreboardBoard'
import { Button } from '@/components/ui/Button'
import { GUEST_SCOREBOARD_STORAGE_ID } from '@/constants/guestScoreboard'
import { TEAM } from '@/constants'
import { useLiveScoreboard } from '@/hooks/useLiveScoreboard'
import { useOrientationLock } from '@/hooks/useOrientationLock'
import { clearScoreboardState } from '@/lib/scoreboardStorage'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function parseGamesParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1 || n > 6) return 3
  return Math.floor(n)
}

function parseNameParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '').trim()
}

export default function GuestScoreboardPlayScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ teamA?: string; teamB?: string; games?: string }>()

  useOrientationLock(ScreenOrientation.OrientationLock.LANDSCAPE, 'scoreboard')

  const teamAName = useMemo(() => parseNameParam(params.teamA), [params.teamA])
  const teamBName = useMemo(() => parseNameParam(params.teamB), [params.teamB])
  const durationTargetGames = useMemo(() => parseGamesParam(params.games), [params.games])

  const {
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
  } = useLiveScoreboard(GUEST_SCOREBOARD_STORAGE_ID, durationTargetGames)

  const handleGameOverConfirm = useCallback(async () => {
    if (!gameOver) return
    dismissGameOver()
    await clearScoreboardState(GUEST_SCOREBOARD_STORAGE_ID)
    router.replace('/(auth)/login')
  }, [dismissGameOver, gameOver, router])

  if (!teamAName || !teamBName) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Faltan los nombres de las parejas.</Text>
        <Button
          title="Configurar partida"
          onPress={() => router.replace('/(auth)/guest-scoreboard' as Href)}
          style={{ marginTop: 16 }}
        />
      </View>
    )
  }

  if (!loaded) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const winnerName = gameOver?.team === TEAM.A ? teamAName : teamBName
  const scoreLine =
    gameOver != null ? `${teamAName} ${gameOver.gamesA} – ${gameOver.gamesB} ${teamBName}` : ''

  return (
    <View style={s.root}>
      <ScoreboardBoard
        teamAName={teamAName}
        teamBName={teamBName}
        state={state}
        canUndo={canUndo}
        onTapPairPoint={tapPairPoint}
        onAdjustPairPoints={adjustPairPoints}
        onTapRound={tapRound}
        onAdjustRound={adjustRound}
        onAwardRound={awardRound}
        onAdjustGames={adjustGames}
        onUndo={undo}
        onClose={() => router.replace('/(auth)/login')}
      />

      <Modal
        visible={gameOver !== null}
        animationType="fade"
        transparent
        onRequestClose={handleGameOverConfirm}>
        <View style={s.overlay}>
          <View style={s.gameOverCard}>
            <Text style={s.gameOverTitle}>¡Partida terminada!</Text>
            <Text style={s.gameOverMessage}>{winnerName} gana la partida</Text>
            <Text style={s.gameOverScore}>{scoreLine}</Text>
            <Button title="Volver al inicio" onPress={handleGameOverConfirm} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gameOverCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gameOverTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  gameOverMessage: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  gameOverScore: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
})
