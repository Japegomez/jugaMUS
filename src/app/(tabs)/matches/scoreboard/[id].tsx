import { useCallback } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'

import { ScoreboardBoard } from '@/components/matches/ScoreboardBoard'
import { Button } from '@/components/ui/Button'
import { MATCH_STATUS, TEAM } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { useMatch } from '@/hooks/useMatches'
import { useLiveScoreboard } from '@/hooks/useLiveScoreboard'
import { useOrientationLock } from '@/hooks/useOrientationLock'
import { resolveTeamName } from '@/services/matches.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export default function ScoreboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const userId = useAuthStore((state) => state.session?.user.id)

  useOrientationLock(ScreenOrientation.OrientationLock.LANDSCAPE)

  const { data: match, isLoading, isError } = useMatch(id)

  const durationTargetGames = match?.duration_target_games ?? 3
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
  } = useLiveScoreboard(id, durationTargetGames)

  const teamAName = match ? resolveTeamName(match, TEAM.A, match.participants) : ''
  const teamBName = match ? resolveTeamName(match, TEAM.B, match.participants) : ''

  const handleGameOverConfirm = useCallback(() => {
    if (!gameOver) return
    dismissGameOver()
    router.replace({
      pathname: '/(tabs)/matches/[id]',
      params: {
        id,
        openResult: '1',
        gamesA: String(gameOver.gamesA),
        gamesB: String(gameOver.gamesB),
      },
    } as Href)
  }, [dismissGameOver, gameOver, id, router])

  if (isLoading || !loaded) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (isError || !match) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>No se pudo cargar la partida.</Text>
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const activeParticipants = match.participants.filter((p) => p.left_at === null)
  const isParticipant = activeParticipants.some((p) => p.user_id === userId)
  const isInProgress = match.status === MATCH_STATUS.IN_PROGRESS

  if (!userId || !isParticipant || !isInProgress) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>No puedes llevar la cuenta de esta partida.</Text>
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
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
        onClose={() => router.back()}
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
            <Text style={s.gameOverHint}>Registra el resultado oficial de la partida.</Text>
            <Button title="Registrar resultado" onPress={handleGameOverConfirm} />
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
    marginBottom: 8,
  },
  gameOverHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
})
