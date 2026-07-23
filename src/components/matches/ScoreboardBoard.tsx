import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  SCOREBOARD_TUTORIAL_STEPS,
  ScoreboardTutorial,
  type ScoreboardTutorialHighlight,
} from '@/components/matches/ScoreboardTutorial'
import { MUS_ROUNDS, MUS_ROUND_LABELS, TEAM } from '@/constants'
import type { MusRound } from '@/constants'
import type { LiveScoreboardState, TeamId } from '@/hooks/useLiveScoreboard'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type ScoreboardBoardProps = {
  teamAName: string
  teamBName: string
  state: LiveScoreboardState
  canUndo: boolean
  onTapPairPoint: (team: TeamId) => void
  onAdjustPairPoints: (team: TeamId, delta: number) => void
  onTapRound: (round: MusRound) => void
  onAdjustRound: (round: MusRound, delta: number) => void
  onAwardRound: (round: MusRound, team: TeamId) => void
  onAdjustGames: (team: TeamId, delta: number) => void
  onUndo: () => void
  onClose: () => void
}

function ChipButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  accessibilityLabel: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.chip, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  )
}

function GamesStepper({
  team,
  games,
  teamName,
  dimmed,
  onAdjustGames,
}: {
  team: TeamId
  games: number
  teamName: string
  dimmed: boolean
  onAdjustGames: (team: TeamId, delta: number) => void
}) {
  return (
    <View style={[s.gamesRow, dimmed && s.dimmed]}>
      <Pressable
        onPress={() => onAdjustGames(team, -1)}
        style={({ pressed }) => [s.gamesBtn, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Restar juego a ${teamName}`}>
        <Text style={s.gamesBtnText}>−</Text>
      </Pressable>
      <View style={s.gamesValueBox}>
        <Text style={s.gamesValue}>{games}</Text>
        <Text style={s.gamesLabel}>juegos</Text>
      </View>
      <Pressable
        onPress={() => onAdjustGames(team, 1)}
        style={({ pressed }) => [s.gamesBtn, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Sumar juego a ${teamName}`}>
        <Text style={s.gamesBtnText}>+</Text>
      </Pressable>
    </View>
  )
}

function PairColumn({
  team,
  teamName,
  points,
  games,
  tutorialActive,
  highlight,
  onTapPairPoint,
  onAdjustPairPoints,
  onAdjustGames,
}: {
  team: TeamId
  teamName: string
  points: number
  games: number
  tutorialActive: boolean
  highlight: ScoreboardTutorialHighlight
  onTapPairPoint: (team: TeamId) => void
  onAdjustPairPoints: (team: TeamId, delta: number) => void
  onAdjustGames: (team: TeamId, delta: number) => void
}) {
  const highlightPoints = highlight === 'pairPoints' || highlight === 'arrowsAndPairPoints'

  const minusBtn = (
    <ChipButton
      key="m1"
      label="−1"
      onPress={() => onAdjustPairPoints(team, -1)}
      accessibilityLabel={`Restar 1 punto a ${teamName}`}
    />
  )
  const plusOneBtn = (
    <ChipButton
      key="p1"
      label="+1"
      onPress={() => onAdjustPairPoints(team, 1)}
      accessibilityLabel={`Sumar 1 punto a ${teamName}`}
    />
  )
  const plusFiveBtn = (
    <ChipButton
      key="p5"
      label="+5"
      onPress={() => onAdjustPairPoints(team, 5)}
      accessibilityLabel={`Sumar 5 puntos a ${teamName}`}
    />
  )
  const pointButtons = [minusBtn, plusOneBtn, plusFiveBtn]

  return (
    <View style={s.pairColumn}>
      <Text style={[s.teamName, tutorialActive && s.dimmed]} numberOfLines={1}>
        {teamName}
      </Text>

      <Pressable
        onPress={() => onTapPairPoint(team)}
        style={({ pressed }) => [
          s.pointsSquare,
          pressed && s.pointsSquarePressed,
          tutorialActive && !highlightPoints && s.dimmed,
          highlightPoints && s.spotlight,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Sumar 1 punto a ${teamName}`}>
        <Text style={s.pointsValue} adjustsFontSizeToFit numberOfLines={1}>
          {points}
        </Text>
      </Pressable>

      <View style={[s.chipRow, tutorialActive && s.dimmed]}>{pointButtons}</View>

      <GamesStepper
        team={team}
        games={games}
        teamName={teamName}
        dimmed={tutorialActive}
        onAdjustGames={onAdjustGames}
      />
    </View>
  )
}

function RoundRow({
  round,
  value,
  tutorialActive,
  highlight,
  onTapRound,
  onAdjustRound,
  onAwardRound,
}: {
  round: MusRound
  value: number
  tutorialActive: boolean
  highlight: ScoreboardTutorialHighlight
  onTapRound: (round: MusRound) => void
  onAdjustRound: (round: MusRound, delta: number) => void
  onAwardRound: (round: MusRound, team: TeamId) => void
}) {
  const label = MUS_ROUND_LABELS[round]
  const highlightCenters = highlight === 'roundCenters'
  const highlightArrows = highlight === 'arrowsAndPairPoints'

  return (
    <View style={s.roundRow}>
      <View style={[s.roundHeader, tutorialActive && s.dimmed]}>
        <View style={s.roundAdjustGroup}>
          <ChipButton
            label="−1"
            onPress={() => onAdjustRound(round, -1)}
            accessibilityLabel={`Restar 1 a ${label}`}
          />
          <ChipButton
            label="+1"
            onPress={() => onAdjustRound(round, 1)}
            accessibilityLabel={`Sumar 1 a ${label}`}
          />
        </View>
        <Text style={s.roundLabel}>{label}</Text>
        <ChipButton
          label="+5"
          onPress={() => onAdjustRound(round, 5)}
          accessibilityLabel={`Sumar 5 a ${label}`}
        />
      </View>

      <View style={s.roundValueRow}>
        <Pressable
          onPress={() => onAwardRound(round, TEAM.A)}
          hitSlop={8}
          style={({ pressed }) => [
            s.arrowBtn,
            pressed && s.pressed,
            tutorialActive && !highlightArrows && s.dimmed,
            highlightArrows && s.spotlightSoft,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sumar ${label} a la pareja de la izquierda`}>
          <Text style={s.arrowText}>←</Text>
        </Pressable>

        <Pressable
          onPress={() => onTapRound(round)}
          style={({ pressed }) => [
            s.roundValueBox,
            pressed && s.pressed,
            tutorialActive && !highlightCenters && s.dimmed,
            highlightCenters && s.spotlight,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sumar 2 a ${label}`}>
          <Text style={s.roundValue}>{value}</Text>
        </Pressable>

        <Pressable
          onPress={() => onAwardRound(round, TEAM.B)}
          hitSlop={8}
          style={({ pressed }) => [
            s.arrowBtn,
            pressed && s.pressed,
            tutorialActive && !highlightArrows && s.dimmed,
            highlightArrows && s.spotlightSoft,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sumar ${label} a la pareja de la derecha`}>
          <Text style={s.arrowText}>→</Text>
        </Pressable>
      </View>
    </View>
  )
}

export function ScoreboardBoard({
  teamAName,
  teamBName,
  state,
  canUndo,
  onTapPairPoint,
  onAdjustPairPoints,
  onTapRound,
  onAdjustRound,
  onAwardRound,
  onAdjustGames,
  onUndo,
  onClose,
}: ScoreboardBoardProps) {
  const insets = useSafeAreaInsets()
  const [tutorialVisible, setTutorialVisible] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

  const finishTutorial = useCallback(() => {
    setTutorialVisible(false)
  }, [])

  const handleBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1))
  }, [])

  const handleNext = useCallback(() => {
    if (stepIndex >= SCOREBOARD_TUTORIAL_STEPS.length - 1) {
      finishTutorial()
      return
    }
    setStepIndex((current) => current + 1)
  }, [finishTutorial, stepIndex])

  const highlight: ScoreboardTutorialHighlight = tutorialVisible
    ? (SCOREBOARD_TUTORIAL_STEPS[stepIndex]?.highlight ?? 'none')
    : 'none'
  const highlightUndo = highlight === 'undo'

  const cornerOffset = {
    bottom: insets.bottom + 10,
    left: insets.left + 10,
    right: insets.right + 10,
  }

  return (
    <View style={s.board}>
      {tutorialVisible ? <View style={s.screenDim} pointerEvents="none" /> : null}

      <View style={s.mainRow}>
        <PairColumn
          team={TEAM.A}
          teamName={teamAName}
          points={state.pointsA}
          games={state.gamesA}
          tutorialActive={tutorialVisible}
          highlight={highlight}
          onTapPairPoint={onTapPairPoint}
          onAdjustPairPoints={onAdjustPairPoints}
          onAdjustGames={onAdjustGames}
        />

        <View style={s.centerColumn}>
          {MUS_ROUNDS.map((round) => (
            <RoundRow
              key={round}
              round={round}
              value={state.rounds[round]}
              tutorialActive={tutorialVisible}
              highlight={highlight}
              onTapRound={onTapRound}
              onAdjustRound={onAdjustRound}
              onAwardRound={onAwardRound}
            />
          ))}
        </View>

        <PairColumn
          team={TEAM.B}
          teamName={teamBName}
          points={state.pointsB}
          games={state.gamesB}
          tutorialActive={tutorialVisible}
          highlight={highlight}
          onTapPairPoint={onTapPairPoint}
          onAdjustPairPoints={onAdjustPairPoints}
          onAdjustGames={onAdjustGames}
        />
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [
          s.backBtn,
          { left: cornerOffset.left, bottom: cornerOffset.bottom },
          pressed && s.pressed,
          tutorialVisible && s.dimmed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar">
        <Text style={s.cornerBtnText}>✕</Text>
      </Pressable>

      <Pressable
        onPress={onUndo}
        disabled={!canUndo}
        hitSlop={12}
        style={({ pressed }) => [
          s.undoBtn,
          { right: cornerOffset.right, bottom: cornerOffset.bottom },
          pressed && s.pressed,
          !canUndo && !highlightUndo && s.cornerBtnDisabled,
          tutorialVisible && !highlightUndo && s.dimmed,
          highlightUndo && [s.spotlightSoft, s.undoBtnRaised],
        ]}
        accessibilityRole="button"
        accessibilityLabel="Deshacer último cambio">
        <Ionicons name="arrow-undo" size={22} color={Colors.white} />
      </Pressable>

      {tutorialVisible ? (
        <ScoreboardTutorial
          stepIndex={stepIndex}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={finishTutorial}
        />
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  board: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  screenDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    zIndex: 1,
  },
  dimmed: {
    opacity: 0.38,
  },
  spotlight: {
    opacity: 1,
    borderColor: '#F0D56A',
    shadowColor: '#F0D56A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 2,
  },
  spotlightSoft: {
    opacity: 1,
    backgroundColor: 'rgba(240,213,106,0.28)',
    borderColor: '#F0D56A',
    zIndex: 2,
  },
  backBtn: {
    position: 'absolute',
    width: 40,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  cornerBtnDisabled: { opacity: 0.35 },
  cornerBtnText: { color: Colors.white, fontSize: 20, fontFamily: Fonts.bold, lineHeight: 24 },
  undoBtn: {
    position: 'absolute',
    width: 40,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  undoBtnRaised: {
    zIndex: 60,
    elevation: 60,
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: 2,
  },

  pairColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
  },
  teamName: {
    color: Colors.white,
    fontSize: 24,
    fontFamily: Fonts.bold,
    marginBottom: 12,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  pointsSquare: {
    alignSelf: 'center',
    height: '44%',
    maxHeight: 180,
    minHeight: 112,
    aspectRatio: 0.82,
    flexGrow: 0,
    flexShrink: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pointsSquarePressed: { backgroundColor: '#EDEDED' },
  pointsValue: {
    fontSize: 80,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textPrimary },
  pressed: { opacity: 0.7 },

  gamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gamesBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gamesBtnText: { color: Colors.white, fontSize: 22, fontFamily: Fonts.bold, lineHeight: 24 },
  gamesValueBox: { alignItems: 'center', minWidth: 52 },
  gamesValue: { color: Colors.white, fontSize: 28, fontFamily: Fonts.bold, lineHeight: 30 },
  gamesLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  centerColumn: {
    flex: 1.15,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  roundRow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  roundAdjustGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roundLabel: {
    color: Colors.white,
    fontSize: 17,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  roundValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: Colors.white, fontSize: 34, fontFamily: Fonts.bold, lineHeight: 38 },
  roundValueBox: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundValue: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary },
})
