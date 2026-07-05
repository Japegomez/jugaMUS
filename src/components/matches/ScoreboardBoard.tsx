import { Pressable, StyleSheet, Text, View } from 'react-native'

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
  onReset: () => void
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
  reversed,
  onAdjustGames,
}: {
  team: TeamId
  games: number
  teamName: string
  reversed?: boolean
  onAdjustGames: (team: TeamId, delta: number) => void
}) {
  const minus = (
    <Pressable
      key="minus"
      onPress={() => onAdjustGames(team, -1)}
      style={({ pressed }) => [s.gamesBtn, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Restar juego a ${teamName}`}>
      <Text style={s.gamesBtnText}>−</Text>
    </Pressable>
  )
  const value = (
    <View key="value" style={s.gamesValueBox}>
      <Text style={s.gamesValue}>{games}</Text>
      <Text style={s.gamesLabel}>juegos</Text>
    </View>
  )
  const plus = (
    <Pressable
      key="plus"
      onPress={() => onAdjustGames(team, 1)}
      style={({ pressed }) => [s.gamesBtn, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Sumar juego a ${teamName}`}>
      <Text style={s.gamesBtnText}>+</Text>
    </Pressable>
  )
  const children = reversed ? [plus, value, minus] : [minus, value, plus]
  return <View style={s.gamesRow}>{children}</View>
}

function PairColumn({
  team,
  teamName,
  points,
  games,
  subtractOnRight,
  onTapPairPoint,
  onAdjustPairPoints,
  onAdjustGames,
}: {
  team: TeamId
  teamName: string
  points: number
  games: number
  subtractOnRight?: boolean
  onTapPairPoint: (team: TeamId) => void
  onAdjustPairPoints: (team: TeamId, delta: number) => void
  onAdjustGames: (team: TeamId, delta: number) => void
}) {
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
  const pointButtons = subtractOnRight
    ? [plusOneBtn, plusFiveBtn, minusBtn]
    : [minusBtn, plusOneBtn, plusFiveBtn]

  return (
    <View style={s.pairColumn}>
      <Text style={s.teamName} numberOfLines={1}>
        {teamName}
      </Text>

      <Pressable
        onPress={() => onTapPairPoint(team)}
        style={({ pressed }) => [s.pointsSquare, pressed && s.pointsSquarePressed]}
        accessibilityRole="button"
        accessibilityLabel={`Sumar 1 punto a ${teamName}`}>
        <Text style={s.pointsValue} adjustsFontSizeToFit numberOfLines={1}>
          {points}
        </Text>
      </Pressable>

      <View style={s.chipRow}>{pointButtons}</View>

      <GamesStepper
        team={team}
        games={games}
        teamName={teamName}
        reversed={subtractOnRight}
        onAdjustGames={onAdjustGames}
      />
    </View>
  )
}

function RoundRow({
  round,
  value,
  onTapRound,
  onAdjustRound,
  onAwardRound,
}: {
  round: MusRound
  value: number
  onTapRound: (round: MusRound) => void
  onAdjustRound: (round: MusRound, delta: number) => void
  onAwardRound: (round: MusRound, team: TeamId) => void
}) {
  const label = MUS_ROUND_LABELS[round]
  return (
    <View style={s.roundRow}>
      <View style={s.roundHeader}>
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
          style={({ pressed }) => [s.arrowBtn, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Sumar ${label} a la pareja de la izquierda`}>
          <Text style={s.arrowText}>←</Text>
        </Pressable>

        <Pressable
          onPress={() => onTapRound(round)}
          style={({ pressed }) => [s.roundValueBox, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Sumar 2 a ${label}`}>
          <Text style={s.roundValue}>{value}</Text>
        </Pressable>

        <Pressable
          onPress={() => onAwardRound(round, TEAM.B)}
          hitSlop={8}
          style={({ pressed }) => [s.arrowBtn, pressed && s.pressed]}
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
  onReset,
  onClose,
}: ScoreboardBoardProps) {
  return (
    <View style={s.board}>
      <View style={s.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [s.topBtn, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <Text style={s.topBtnText}>←</Text>
        </Pressable>

        <Pressable
          onPress={onReset}
          hitSlop={12}
          style={({ pressed }) => [s.topBtn, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Reiniciar marcador">
          <Text style={s.topBtnText}>↺</Text>
        </Pressable>
      </View>

      <View style={s.mainRow}>
        <PairColumn
          team={TEAM.A}
          teamName={teamAName}
          points={state.pointsA}
          games={state.gamesA}
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
          subtractOnRight
          onTapPairPoint={onTapPairPoint}
          onAdjustPairPoints={onAdjustPairPoints}
          onAdjustGames={onAdjustGames}
        />
      </View>

      <Pressable
        onPress={onUndo}
        disabled={!canUndo}
        hitSlop={12}
        style={({ pressed }) => [s.undoBtn, pressed && s.pressed, !canUndo && s.topBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Deshacer último cambio">
        <Text style={s.topBtnText}>↶</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  board: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  topBtn: {
    width: 40,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  topBtnDisabled: { opacity: 0.35 },
  topBtnText: { color: Colors.white, fontSize: 20, fontFamily: Fonts.bold, lineHeight: 24 },
  undoBtn: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    width: 40,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },

  pairColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  teamName: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  pointsSquare: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.white,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  pointsSquarePressed: { backgroundColor: '#EDEDED' },
  pointsValue: {
    fontSize: 96,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gamesBtnText: { color: Colors.white, fontSize: 20, fontFamily: Fonts.bold, lineHeight: 22 },
  gamesValueBox: { alignItems: 'center', minWidth: 44 },
  gamesValue: { color: Colors.white, fontSize: 22, fontFamily: Fonts.bold, lineHeight: 24 },
  gamesLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },

  centerColumn: {
    flex: 1.15,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  roundRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundValue: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary },
})
