import { StyleSheet, Text, View } from 'react-native'

import type { IndividualH2H, MatchInsightPlayer, PairH2H } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function nameById(players: MatchInsightPlayer[], id: string): string {
  return players.find((p) => p.user_id === id)?.display_name ?? 'Jugador'
}

export function HeadToHeadCard({
  players,
  individual,
  pair,
}: {
  players: MatchInsightPlayer[]
  individual: IndividualH2H[]
  pair: PairH2H | null
}) {
  const meaningful = individual.filter((h) => h.wins_a + h.wins_b > 0)

  if (!meaningful.length && !pair) {
    return <Text style={styles.empty}>Sin historial previo entre estos jugadores</Text>
  }

  return (
    <View style={styles.wrap}>
      {meaningful.map((h) => (
        <View key={`${h.user_a}-${h.user_b}`} style={styles.row}>
          <Text style={styles.names} numberOfLines={1}>
            {`${nameById(players, h.user_a)} vs ${nameById(players, h.user_b)}`}
          </Text>
          <Text style={styles.score}>{`${h.wins_a}–${h.wins_b}`}</Text>
        </View>
      ))}
      {pair ? (
        <View style={[styles.row, styles.pairRow]}>
          <Text style={styles.names}>Pareja vs pareja</Text>
          <Text style={styles.score}>{`${pair.wins_a}–${pair.wins_b}`}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pairRow: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  names: {
    flex: 1,
    marginRight: 12,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  score: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.primary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
