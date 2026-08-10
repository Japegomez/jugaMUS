import { StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function WinRateBar({
  winRate,
  wins,
  losses,
}: {
  winRate: number
  wins: number
  losses: number
}) {
  const pct = Math.max(0, Math.min(100, winRate))
  return (
    <View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{`${pct}% victorias`}</Text>
        <Text style={styles.meta}>{`${wins}G · ${losses}P`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meta: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.historyLostBackground,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
})
