import { Pressable, StyleSheet, Text, View } from 'react-native'

import { MUS_PHASE_LABELS, TEAM, type MusPhase } from '@/constants'
import type { TeamId } from '@/hooks/useLiveScoreboard'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type PhaseRowProps = {
  phase: MusPhase
  bet: number
  winnerTeam: TeamId | null
  teamAName: string
  teamBName: string
  onAdjustBet: (delta: number) => void
  onSelectWinner: (team: TeamId) => void
}

function BetButton({
  label,
  variant,
  onPress,
}: {
  label: string
  variant: 'add' | 'subtract'
  onPress: () => void
}) {
  const isAdd = variant === 'add'
  return (
    <Pressable
      style={[s.betBtn, isAdd ? s.betBtnAdd : s.betBtnSub]}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={[s.betBtnText, isAdd ? s.betBtnTextAdd : s.betBtnTextSub]}>{label}</Text>
    </Pressable>
  )
}

function TeamChip({
  name,
  selected,
  onPress,
}: {
  name: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[s.teamChip, selected && s.teamChipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[s.teamChipText, selected && s.teamChipTextSelected]} numberOfLines={2}>
        {name}
      </Text>
    </Pressable>
  )
}

export function PhaseRow({
  phase,
  bet,
  winnerTeam,
  teamAName,
  teamBName,
  onAdjustBet,
  onSelectWinner,
}: PhaseRowProps) {
  return (
    <View style={s.row}>
      <TeamChip
        name={teamAName}
        selected={winnerTeam === TEAM.A}
        onPress={() => onSelectWinner(TEAM.A)}
      />

      <View style={s.center}>
        <Text style={s.phaseLabel}>{MUS_PHASE_LABELS[phase]}</Text>
        <Text style={s.betValue}>{bet}</Text>
        <View style={s.betControls}>
          <BetButton label="−1" variant="subtract" onPress={() => onAdjustBet(-1)} />
          <BetButton label="+2" variant="add" onPress={() => onAdjustBet(2)} />
        </View>
      </View>

      <TeamChip
        name={teamBName}
        selected={winnerTeam === TEAM.B}
        onPress={() => onSelectWinner(TEAM.B)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  center: { flex: 1, alignItems: 'center', minWidth: 0 },
  phaseLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  betValue: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 6,
  },
  betControls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  betBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  betBtnAdd: {
    backgroundColor: Colors.wonBackground,
    borderColor: Colors.primary,
  },
  betBtnSub: {
    backgroundColor: Colors.lostBackground,
    borderColor: Colors.danger,
  },
  betBtnText: { fontSize: 13, fontFamily: Fonts.semiBold },
  betBtnTextAdd: { color: Colors.primary },
  betBtnTextSub: { color: Colors.danger },
  teamChip: {
    flex: 1,
    minHeight: 72,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.wonBackground,
  },
  teamChipText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  teamChipTextSelected: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
  },
})
