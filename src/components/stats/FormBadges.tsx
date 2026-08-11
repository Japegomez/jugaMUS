import { StyleSheet, Text, View } from 'react-native'

import type { FormOutcome } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function FormBadges({ form }: { form: FormOutcome[] }) {
  if (!form.length) {
    return <Text style={styles.empty}>Sin forma reciente</Text>
  }

  return (
    <View style={styles.row}>
      {form.map((outcome, index) => (
        <View
          key={`${outcome}-${index}`}
          style={[styles.dot, outcome === 'won' ? styles.won : styles.lost]}>
          <Text style={styles.dotText}>{outcome === 'won' ? 'G' : 'P'}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  won: {
    backgroundColor: Colors.historyWonBackground,
  },
  lost: {
    backgroundColor: Colors.historyLostBackground,
  },
  dotText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
})
