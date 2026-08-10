import { StyleSheet, Text, View } from 'react-native'

import type { LeagueStandingRow } from '@/services/leagues.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type EloRankingProps = {
  rows: LeagueStandingRow[]
  emptyLabel?: string
}

/** Ranking by Elo (open league). Rows should already be sorted by current_elo desc. */
export function EloRanking({ rows, emptyLabel = 'Sin clasificados aún' }: EloRankingProps) {
  const sorted = [...rows].sort((a, b) => {
    if (b.current_elo !== a.current_elo) return b.current_elo - a.current_elo
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.pair_name.localeCompare(b.pair_name)
  })

  if (sorted.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>
  }

  return (
    <View style={styles.list}>
      {sorted.map((row, index) => {
        const rank = index + 1
        const isPodium = rank <= 3
        return (
          <View key={row.pair_id} style={[styles.row, isPodium && styles.rowPodium]}>
            <Text style={[styles.rank, isPodium && styles.rankPodium]}>{rank}</Text>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {row.pair_name}
              </Text>
              <Text style={styles.meta}>
                {row.played} partidas · {row.wins}V / {row.losses}D
              </Text>
            </View>
            <Text style={styles.elo}>{row.current_elo}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { color: Colors.textSecondary, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  rowPodium: { borderColor: Colors.primary, borderWidth: 1 },
  rank: {
    width: 28,
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  rankPodium: { color: Colors.primary, fontSize: 18 },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  elo: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.primary },
})
