import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
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
import { useHiddenStatusBar } from '@/hooks/useHiddenStatusBar'
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

type BoardStyles = ReturnType<typeof createBoardStyles>

/** Escala el layout landscape para pantallas bajas (p. ej. iPhone 14 en horizontal). */
function useBoardScale() {
  const { height, width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const shortSide = Math.min(width, height)
  const availableHeight = Math.max(260, shortSide - insets.top - insets.bottom)
  // Diseño de referencia ~400–420 pt de altura útil en landscape.
  const rawScale = Math.min(1, Math.max(0.7, availableHeight / 400))
  // Quantize to 0.05 steps to avoid insignificant style churn.
  const scale = Math.round(rawScale * 20) / 20
  return { scale, insets }
}

function ChipButton({
  label,
  onPress,
  accessibilityLabel,
  styles,
  size = 'default',
}: {
  label: string
  onPress: () => void
  accessibilityLabel: string
  styles: BoardStyles
  size?: 'default' | 'pair' | 'round'
}) {
  const chipStyle =
    size === 'pair' ? styles.pairChip : size === 'round' ? styles.roundChip : styles.chip
  const textStyle =
    size === 'pair'
      ? styles.pairChipText
      : size === 'round'
        ? styles.roundChipText
        : styles.chipText
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [chipStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Text style={textStyle} allowFontScaling={false}>
        {label}
      </Text>
    </Pressable>
  )
}

function GamesStepper({
  team,
  games,
  teamName,
  dimmed,
  onAdjustGames,
  styles,
}: {
  team: TeamId
  games: number
  teamName: string
  dimmed: boolean
  onAdjustGames: (team: TeamId, delta: number) => void
  styles: BoardStyles
}) {
  return (
    <View style={[styles.gamesRow, dimmed && styles.dimmed]}>
      <Pressable
        onPress={() => onAdjustGames(team, -1)}
        style={({ pressed }) => [styles.gamesBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Restar juego a ${teamName}`}>
        <Text style={styles.gamesBtnText} allowFontScaling={false}>
          −
        </Text>
      </Pressable>
      <View style={styles.gamesValueBox}>
        <Text style={styles.gamesValue} allowFontScaling={false}>
          {games}
        </Text>
        <Text style={styles.gamesLabel} allowFontScaling={false}>
          juegos
        </Text>
      </View>
      <Pressable
        onPress={() => onAdjustGames(team, 1)}
        style={({ pressed }) => [styles.gamesBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Sumar juego a ${teamName}`}>
        <Text style={styles.gamesBtnText} allowFontScaling={false}>
          +
        </Text>
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
  styles,
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
  styles: BoardStyles
}) {
  const highlightPoints = highlight === 'pairPoints' || highlight === 'arrowsAndPairPoints'

  const minusBtn = (
    <ChipButton
      key="m1"
      label="−1"
      onPress={() => onAdjustPairPoints(team, -1)}
      accessibilityLabel={`Restar 1 punto a ${teamName}`}
      styles={styles}
      size="pair"
    />
  )
  const plusOneBtn = (
    <ChipButton
      key="p1"
      label="+1"
      onPress={() => onAdjustPairPoints(team, 1)}
      accessibilityLabel={`Sumar 1 punto a ${teamName}`}
      styles={styles}
      size="pair"
    />
  )
  const plusFiveBtn = (
    <ChipButton
      key="p5"
      label="+5"
      onPress={() => onAdjustPairPoints(team, 5)}
      accessibilityLabel={`Sumar 5 puntos a ${teamName}`}
      styles={styles}
      size="pair"
    />
  )
  const pointButtons = [minusBtn, plusOneBtn, plusFiveBtn]

  return (
    <View style={styles.pairColumn}>
      <Text
        style={[styles.teamName, tutorialActive && styles.dimmed]}
        numberOfLines={1}
        allowFontScaling={false}>
        {teamName}
      </Text>

      <Pressable
        onPress={() => onTapPairPoint(team)}
        style={({ pressed }) => [
          styles.pointsSquare,
          pressed && styles.pointsSquarePressed,
          tutorialActive && !highlightPoints && styles.dimmed,
          highlightPoints && styles.spotlight,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Sumar 1 punto a ${teamName}`}>
        <Text
          style={styles.pointsValue}
          adjustsFontSizeToFit
          numberOfLines={1}
          allowFontScaling={false}>
          {points}
        </Text>
      </Pressable>

      <View style={[styles.chipRow, tutorialActive && styles.dimmed]}>{pointButtons}</View>

      <GamesStepper
        team={team}
        games={games}
        teamName={teamName}
        dimmed={tutorialActive}
        onAdjustGames={onAdjustGames}
        styles={styles}
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
  styles,
}: {
  round: MusRound
  value: number
  tutorialActive: boolean
  highlight: ScoreboardTutorialHighlight
  onTapRound: (round: MusRound) => void
  onAdjustRound: (round: MusRound, delta: number) => void
  onAwardRound: (round: MusRound, team: TeamId) => void
  styles: BoardStyles
}) {
  const label = MUS_ROUND_LABELS[round]
  const highlightCenters = highlight === 'roundCenters'
  const highlightArrows = highlight === 'arrowsAndPairPoints'

  return (
    <View style={styles.roundRow}>
      <View style={[styles.roundHeader, tutorialActive && styles.dimmed]}>
        <View style={styles.roundAdjustGroup}>
          <ChipButton
            label="−1"
            onPress={() => onAdjustRound(round, -1)}
            accessibilityLabel={`Restar 1 a ${label}`}
            styles={styles}
            size="round"
          />
          <ChipButton
            label="+1"
            onPress={() => onAdjustRound(round, 1)}
            accessibilityLabel={`Sumar 1 a ${label}`}
            styles={styles}
            size="round"
          />
        </View>
        <Text style={styles.roundLabel} numberOfLines={1} allowFontScaling={false}>
          {label}
        </Text>
        <ChipButton
          label="+5"
          onPress={() => onAdjustRound(round, 5)}
          accessibilityLabel={`Sumar 5 a ${label}`}
          styles={styles}
          size="round"
        />
      </View>

      {/* Slot flexible: centra el contador entre esta etiqueta y la de la siguiente ronda. */}
      <View style={styles.roundValueSlot}>
        <View style={styles.roundValueRow}>
          <Pressable
            onPress={() => onAwardRound(round, TEAM.A)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrowBtn,
              pressed && styles.pressed,
              tutorialActive && !highlightArrows && styles.dimmed,
              highlightArrows && styles.spotlightSoft,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Sumar ${label} a la pareja de la izquierda`}>
            <Text style={styles.arrowText} allowFontScaling={false}>
              ←
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onTapRound(round)}
            style={({ pressed }) => [
              styles.roundValueBox,
              pressed && styles.pressed,
              tutorialActive && !highlightCenters && styles.dimmed,
              highlightCenters && styles.spotlight,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Sumar 2 a ${label}`}>
            <Text style={styles.roundValue} allowFontScaling={false}>
              {value}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onAwardRound(round, TEAM.B)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrowBtn,
              pressed && styles.pressed,
              tutorialActive && !highlightArrows && styles.dimmed,
              highlightArrows && styles.spotlightSoft,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Sumar ${label} a la pareja de la derecha`}>
            <Text style={styles.arrowText} allowFontScaling={false}>
              →
            </Text>
          </Pressable>
        </View>
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
  useHiddenStatusBar()
  const { scale, insets } = useBoardScale()
  const { width, height } = useWindowDimensions()
  const isIosLandscape = Platform.OS === 'ios' && width > height
  const styles = useMemo(() => createBoardStyles(scale), [scale])
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

  const undoIconSize = Math.round(26 * scale)
  const cornerControlGutter = Math.round(58 * scale)
  const cornerInset = Math.round(20 * scale)
  const closeBtnPosition = isIosLandscape
    ? {
        top: cornerInset,
        right: cornerInset,
      }
    : {
        top: cornerInset,
        left: cornerInset,
      }
  const undoBtnPosition = isIosLandscape
    ? {
        bottom: cornerInset,
        right: cornerInset,
      }
    : {
        bottom: cornerInset,
        left: cornerInset,
      }
  const mainRowSidePadding = {
    paddingLeft: cornerControlGutter,
    paddingRight: cornerControlGutter,
  }

  return (
    <View
      style={[
        styles.board,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      {tutorialVisible ? <View style={styles.screenDim} pointerEvents="none" /> : null}

      <View style={[styles.mainRow, mainRowSidePadding]}>
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
          styles={styles}
        />

        <View style={styles.centerColumn}>
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
              styles={styles}
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
          styles={styles}
        />
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [
          styles.backBtn,
          closeBtnPosition,
          pressed && styles.pressed,
          tutorialVisible && styles.dimmed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar">
        <Text style={styles.cornerBtnText} allowFontScaling={false}>
          ✕
        </Text>
      </Pressable>

      <Pressable
        onPress={onUndo}
        disabled={!canUndo}
        hitSlop={12}
        style={({ pressed }) => [
          styles.undoBtn,
          undoBtnPosition,
          pressed && styles.pressed,
          !canUndo && !highlightUndo && styles.cornerBtnDisabled,
          tutorialVisible && !highlightUndo && styles.dimmed,
          highlightUndo && [styles.spotlightSoft, styles.undoBtnRaised],
        ]}
        accessibilityRole="button"
        accessibilityLabel="Deshacer último cambio">
        <Ionicons name="arrow-undo" size={undoIconSize} color={Colors.white} />
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

function createBoardStyles(scale: number) {
  const s = (n: number) => Math.max(1, Math.round(n * scale))
  const fs = (n: number) => Math.max(10, Math.round(n * scale))

  return StyleSheet.create({
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
      width: s(48),
      height: s(42),
      borderRadius: s(9),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
      zIndex: 2,
    },
    cornerBtnDisabled: { opacity: 0.35 },
    cornerBtnText: {
      color: Colors.white,
      fontSize: fs(24),
      fontFamily: Fonts.bold,
      lineHeight: fs(28),
    },
    undoBtn: {
      position: 'absolute',
      width: s(48),
      height: s(42),
      borderRadius: s(9),
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
      gap: s(8),
      paddingHorizontal: s(10),
      minHeight: 0,
      zIndex: 2,
    },

    pairColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: s(12),
      paddingBottom: s(6),
      minHeight: 0,
    },
    teamName: {
      color: Colors.white,
      fontSize: fs(22),
      fontFamily: Fonts.bold,
      marginBottom: s(8),
      paddingHorizontal: 4,
      textAlign: 'center',
    },
    pointsSquare: {
      alignSelf: 'center',
      height: `${36 + 8 * scale}%`,
      maxHeight: s(180),
      minHeight: s(88),
      aspectRatio: 0.82,
      flexGrow: 0,
      flexShrink: 1,
      backgroundColor: Colors.white,
      borderRadius: s(10),
      borderWidth: 2.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s(6),
      paddingHorizontal: s(8),
      paddingVertical: s(4),
    },
    pointsSquarePressed: { backgroundColor: '#EDEDED' },
    pointsValue: {
      fontSize: fs(72),
      fontFamily: Fonts.bold,
      color: Colors.textPrimary,
    },
    chipRow: {
      flexDirection: 'row',
      gap: s(8),
      marginBottom: s(6),
    },
    chip: {
      minWidth: s(40),
      paddingHorizontal: s(7),
      paddingVertical: s(5),
      borderRadius: s(7),
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: { fontSize: fs(14), fontFamily: Fonts.bold, color: Colors.textPrimary },
    pairChip: {
      minWidth: s(52),
      paddingHorizontal: s(12),
      paddingVertical: s(9),
      borderRadius: s(9),
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pairChipText: { fontSize: fs(17), fontFamily: Fonts.bold, color: Colors.textPrimary },
    roundChip: {
      minWidth: s(46),
      paddingHorizontal: s(9),
      paddingVertical: s(6),
      borderRadius: s(8),
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundChipText: { fontSize: fs(15), fontFamily: Fonts.bold, color: Colors.textPrimary },
    pressed: { opacity: 0.7 },

    gamesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(10),
    },
    gamesBtn: {
      width: s(40),
      height: s(40),
      borderRadius: s(20),
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gamesBtnText: {
      color: Colors.white,
      fontSize: fs(24),
      fontFamily: Fonts.bold,
      lineHeight: fs(26),
    },
    gamesValueBox: { alignItems: 'center', minWidth: s(56) },
    gamesValue: {
      color: Colors.white,
      fontSize: fs(32),
      fontFamily: Fonts.bold,
      lineHeight: fs(34),
    },
    gamesLabel: { color: 'rgba(255,255,255,0.75)', fontSize: fs(13) },

    centerColumn: {
      flex: 1.15,
      alignSelf: 'stretch',
      justifyContent: 'flex-start',
      minHeight: 0,
      paddingTop: s(12),
      paddingBottom: 0,
    },
    roundRow: {
      flex: 1,
      minHeight: 0,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 0,
    },
    roundHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(5),
      marginBottom: 0,
      flexShrink: 0,
      zIndex: 1,
    },
    roundAdjustGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(5),
    },
    roundLabel: {
      color: Colors.white,
      fontSize: fs(17),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      flexShrink: 1,
    },
    roundValueSlot: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // Evita que chips de ronda mayores solapen el contador de debajo.
      paddingTop: s(2),
      paddingBottom: s(2),
    },
    roundValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
    },
    arrowBtn: {
      width: s(36),
      height: s(36),
      borderRadius: s(9),
      borderWidth: 1.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowText: {
      color: Colors.white,
      fontSize: fs(28),
      fontFamily: Fonts.bold,
      lineHeight: fs(32),
    },
    roundValueBox: {
      minWidth: s(46),
      paddingHorizontal: s(6),
      paddingVertical: s(2),
      backgroundColor: Colors.white,
      borderRadius: s(8),
      borderWidth: 2.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundValue: { fontSize: fs(22), fontFamily: Fonts.bold, color: Colors.textPrimary },
  })
}
