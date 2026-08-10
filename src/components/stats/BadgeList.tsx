import { StyleSheet, Text, View } from 'react-native'

import { BADGE_LABELS, type PlayerBadge } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function BadgeList({ badges }: { badges: PlayerBadge[] }) {
  if (!badges.length) {
    return <Text style={styles.empty}>Aún no hay logros</Text>
  }

  return (
    <View style={styles.wrap}>
      {badges.map((badge) => (
        <View key={badge.key} style={styles.chip}>
          <Text style={styles.chipText}>{BADGE_LABELS[badge.key] ?? badge.key}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
