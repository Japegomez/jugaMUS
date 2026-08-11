import { StyleSheet, Text, View } from 'react-native'

import type { LeagueStandingRow } from '@/services/leagues.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type StandingsTableProps = {
  rows: LeagueStandingRow[]
  emptyLabel?: string
}

const STAT_COLUMNS = ['PJ', 'PG', 'PP'] as const

export function StandingsTable({
  rows,
  emptyLabel = 'Aún no hay resultados',
}: StandingsTableProps) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>
  }

  return (
    <View style={styles.list}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.rankCell]}>#</Text>
        <Text style={[styles.headerCell, styles.nameCell]}>Pareja</Text>
        {STAT_COLUMNS.map((label) => (
          <Text key={label} style={[styles.headerCell, styles.statCell]}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row) => {
        const isPodium = row.rank <= 3
        return (
          <View key={row.pair_id} style={[styles.row, isPodium && styles.rowPodium]}>
            <Text
              style={[
                styles.cell,
                styles.rankCell,
                styles.rankText,
                isPodium && styles.rankPodium,
              ]}>
              {row.rank}
            </Text>
            <Text style={[styles.cell, styles.nameCell]} numberOfLines={1}>
              {row.pair_name}
            </Text>
            <Text style={[styles.cell, styles.statCell]}>{row.played}</Text>
            <Text style={[styles.cell, styles.statCell, styles.wins]}>{row.wins}</Text>
            <Text style={[styles.cell, styles.statCell, styles.losses]}>{row.losses}</Text>
          </View>
        )
      })}
    </View>
  )
}

const STAT_WIDTH = 34

const styles = StyleSheet.create({
  empty: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  list: { gap: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  headerCell: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rowPodium: { borderColor: Colors.primary, borderWidth: 1 },
  cell: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  rankCell: { width: 28 },
  statCell: { width: STAT_WIDTH },
  rankText: { fontFamily: Fonts.bold, color: Colors.textSecondary },
  rankPodium: { color: Colors.primary, fontSize: 16 },
  nameCell: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    paddingHorizontal: 8,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  wins: { color: Colors.primary, fontFamily: Fonts.semiBold },
  losses: { color: Colors.danger, fontFamily: Fonts.semiBold },
})
