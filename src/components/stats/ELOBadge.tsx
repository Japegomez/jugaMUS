import { StyleSheet, Text, View } from 'react-native'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function ELOBadge({ rating }: { rating: number }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>{rating}</Text>
      <Text style={styles.label}>ELO</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.primary,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },
})
