import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { OrdagoModal } from '@/components/matches/OrdagoModal'
import { PhaseRow } from '@/components/matches/PhaseRow'
import { PointsAdjustModal, type PointsAdjustMode } from '@/components/matches/PointsAdjustModal'
import { ResetScoreboardModal } from '@/components/matches/ResetScoreboardModal'
import { ScoreboardPairCard } from '@/components/matches/ScoreboardPairCard'
import { Button } from '@/components/ui/Button'
import { GUEST_SCOREBOARD_STORAGE_ID } from '@/constants/guestScoreboard'
import { MUS_PHASES, TEAM } from '@/constants'
import { useLiveScoreboard, type TeamId } from '@/hooks/useLiveScoreboard'
import { clearScoreboardState } from '@/lib/scoreboardStorage'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

type PointsAdjustTarget = {
  team: TeamId
  mode: PointsAdjustMode
  teamName: string
}

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
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ teamA?: string; teamB?: string; games?: string }>()

  const teamAName = useMemo(() => parseNameParam(params.teamA), [params.teamA])
  const teamBName = useMemo(() => parseNameParam(params.teamB), [params.teamB])
  const durationTargetGames = useMemo(() => parseGamesParam(params.games), [params.games])

  const {
    state,
    loaded,
    gameOver,
    addPoints,
    subtractPoints,
    adjustGames,
    adjustBet,
    setPhaseWinner,
    advanceRound,
    awardOrdago,
    reset,
    dismissGameOver,
    canSettle,
  } = useLiveScoreboard(GUEST_SCOREBOARD_STORAGE_ID, durationTargetGames)

  const [pointsAdjust, setPointsAdjust] = useState<PointsAdjustTarget | null>(null)
  const [ordagoVisible, setOrdagoVisible] = useState(false)
  const [resetVisible, setResetVisible] = useState(false)
  const [resetting, setResetting] = useState(false)

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

  const handlePointsAdjust = (direction: 'add' | 'subtract', team: TeamId) => {
    const teamName = team === TEAM.A ? teamAName : teamBName
    setPointsAdjust({ team, mode: direction, teamName })
  }

  const handlePointsConfirm = (amount: number) => {
    if (!pointsAdjust) return
    if (pointsAdjust.mode === 'add') addPoints(pointsAdjust.team, amount)
    else subtractPoints(pointsAdjust.team, amount)
    setPointsAdjust(null)
  }

  const handleGamesAdjust = (direction: 'add' | 'subtract', team: TeamId) => {
    adjustGames(team, direction === 'add' ? 1 : -1)
  }

  const handleResetConfirm = async () => {
    setResetting(true)
    try {
      await reset()
      setResetVisible(false)
    } finally {
      setResetting(false)
    }
  }

  const winnerName = gameOver?.team === TEAM.A ? teamAName : teamBName
  const scoreLine =
    gameOver != null ? `${teamAName} ${gameOver.gamesA} – ${gameOver.gamesB} ${teamBName}` : ''

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled">
        <View style={[s.closeBar, { paddingTop: screenTopPadding(insets.top, 8) }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <Text style={s.title}>Llevar la cuenta</Text>
        <Text style={s.subtitle}>
          A {durationTargetGames} juego{durationTargetGames > 1 ? 's' : ''}
        </Text>

        <Text style={s.sectionHint}>
          Marca el ganador de cada fase. Cuando las cuatro estén completas, pulsa «Siguiente ronda»
          para sumar los envites al marcador.
        </Text>

        <View style={s.globalRow}>
          <ScoreboardPairCard
            teamName={teamAName}
            points={state.pointsA}
            games={state.gamesA}
            onAdjustPoints={(dir) => handlePointsAdjust(dir, TEAM.A)}
            onAdjustGames={(dir) => handleGamesAdjust(dir, TEAM.A)}
          />
          <View style={s.vs}>
            <Text style={s.vsText}>vs</Text>
          </View>
          <ScoreboardPairCard
            teamName={teamBName}
            points={state.pointsB}
            games={state.gamesB}
            onAdjustPoints={(dir) => handlePointsAdjust(dir, TEAM.B)}
            onAdjustGames={(dir) => handleGamesAdjust(dir, TEAM.B)}
          />
        </View>

        {MUS_PHASES.map((phase) => (
          <PhaseRow
            key={phase}
            phase={phase}
            bet={state.phases[phase].bet}
            winnerTeam={state.phases[phase].winner}
            teamAName={teamAName}
            teamBName={teamBName}
            onAdjustBet={(delta) => adjustBet(phase, delta)}
            onSelectWinner={(team) => setPhaseWinner(phase, team)}
          />
        ))}

        <Button title="Órdago" onPress={() => setOrdagoVisible(true)} style={s.ordagoBtn} />
        <Button
          title="Siguiente ronda"
          onPress={advanceRound}
          disabled={!canSettle}
          style={s.nextRoundBtn}
        />
        {!canSettle ? (
          <Text style={s.nextRoundHint}>
            Indica el ganador de cada fase para pasar a la siguiente ronda.
          </Text>
        ) : null}
        <Button
          title="Reiniciar marcador"
          variant="outline"
          onPress={() => setResetVisible(true)}
        />
      </ScrollView>

      <PointsAdjustModal
        visible={pointsAdjust !== null}
        mode={pointsAdjust?.mode ?? 'add'}
        teamName={pointsAdjust?.teamName ?? ''}
        onClose={() => setPointsAdjust(null)}
        onConfirm={handlePointsConfirm}
      />

      <OrdagoModal
        visible={ordagoVisible}
        teamAName={teamAName}
        teamBName={teamBName}
        onClose={() => setOrdagoVisible(false)}
        onSelectWinner={awardOrdago}
      />

      <ResetScoreboardModal
        visible={resetVisible}
        loading={resetting}
        onClose={() => setResetVisible(false)}
        onConfirm={handleResetConfirm}
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
    </>
  )
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  closeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: -4,
  },
  closeX: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  title: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  sectionHint: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  globalRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 24 },
  vs: { justifyContent: 'center', paddingHorizontal: 2 },
  vsText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  ordagoBtn: { marginTop: 8, marginBottom: 10, minHeight: 56 },
  nextRoundBtn: { marginBottom: 10, minHeight: 56 },
  nextRoundHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  gameOverCard: {
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
