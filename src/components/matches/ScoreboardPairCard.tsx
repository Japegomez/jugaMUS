import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type ScoreboardPairCardProps = {
  teamName: string
  points: number
  games: number
  onAdjustPoints: (direction: 'add' | 'subtract') => void
  onAdjustGames: (direction: 'add' | 'subtract') => void
}

function CircleButton({
  label,
  variant,
  onPress,
  accessibilityLabel,
}: {
  label: string
  variant: 'add' | 'subtract'
  onPress: () => void
  accessibilityLabel: string
}) {
  const isAdd = variant === 'add'
  return (
    <Pressable
      style={[s.circleBtn, isAdd ? s.circleBtnAdd : s.circleBtnSub]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Text style={[s.circleBtnText, isAdd ? s.circleBtnTextAdd : s.circleBtnTextSub]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function ScoreboardPairCard({
  teamName,
  points,
  games,
  onAdjustPoints,
  onAdjustGames,
}: ScoreboardPairCardProps) {
  return (
    <View style={s.card}>
      <Text style={s.teamName} numberOfLines={2}>
        {teamName}
      </Text>

      <View style={s.gamesRow}>
        <CircleButton
          label="−"
          variant="subtract"
          onPress={() => onAdjustGames('subtract')}
          accessibilityLabel={`Restar juego a ${teamName}`}
        />
        <View style={s.gamesBlock}>
          <Text style={s.gamesValue}>{games}</Text>
          <Text style={s.gamesLabel}>juegos</Text>
        </View>
        <CircleButton
          label="+"
          variant="add"
          onPress={() => onAdjustGames('add')}
          accessibilityLabel={`Sumar juego a ${teamName}`}
        />
      </View>

      <View style={s.pointsRow}>
        <CircleButton
          label="−"
          variant="subtract"
          onPress={() => onAdjustPoints('subtract')}
          accessibilityLabel={`Restar puntos a ${teamName}`}
        />
        <View style={s.pointsBlock}>
          <Text style={s.pointsValue}>{points}</Text>
          <Text style={s.pointsLabel}>puntos</Text>
        </View>
        <CircleButton
          label="+"
          variant="add"
          onPress={() => onAdjustPoints('add')}
          accessibilityLabel={`Sumar puntos a ${teamName}`}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    minHeight: 36,
  },
  gamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  gamesBlock: { alignItems: 'center', flex: 1 },
  gamesValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  gamesLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  pointsBlock: { alignItems: 'center', flex: 1 },
  pointsValue: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    lineHeight: 42,
  },
  pointsLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circleBtnAdd: {
    backgroundColor: Colors.wonBackground,
    borderColor: Colors.primary,
  },
  circleBtnSub: {
    backgroundColor: Colors.lostBackground,
    borderColor: Colors.danger,
  },
  circleBtnText: { fontSize: 20, fontFamily: Fonts.bold, lineHeight: 22 },
  circleBtnTextAdd: { color: Colors.primary },
  circleBtnTextSub: { color: Colors.danger },
})
