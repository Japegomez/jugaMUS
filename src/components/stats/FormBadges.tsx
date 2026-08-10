import { StyleSheet, Text, View } from 'react-native'

import type { FormOutcome } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function FormBadges({
  form,
  showTimeline = false,
}: {
  form: FormOutcome[]
  /** When true, draw arrows oldest → newest and mark the latest match. */
  showTimeline?: boolean
}) {
  const recent = form.slice(-5)

  if (!recent.length) {
    return <Text style={styles.empty}>{showTimeline ? 'Sin partidas recientes' : 'Sin forma reciente'}</Text>
  }

  const lastIndex = recent.length - 1

  return (
    <View style={styles.row}>
      {recent.map((outcome, index) => {
        const isLatest = showTimeline && index === lastIndex
        return (
          <View key={`${outcome}-${index}`} style={styles.item}>
            {index > 0 ? (
              <Text style={[styles.arrow, isLatest && styles.arrowLatest]} accessible={false}>
                →
              </Text>
            ) : null}
            <View style={styles.dotWrap}>
              <View
                style={[
                  styles.dot,
                  outcome === 'won' ? styles.won : styles.lost,
                  isLatest && styles.dotLatest,
                ]}>
                <Text style={[styles.dotText, isLatest && styles.dotTextLatest]}>
                  {outcome === 'won' ? 'V' : 'D'}
                </Text>
              </View>
              {isLatest ? <Text style={styles.latestLabel}>Última</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  arrow: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  arrowLatest: {
    color: Colors.primary,
  },
  dotWrap: {
    alignItems: 'center',
    gap: 2,
    minWidth: 28,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  won: {
    backgroundColor: Colors.historyWonBackground,
  },
  lost: {
    backgroundColor: Colors.historyLostBackground,
  },
  dotLatest: {
    borderWidth: 2,
    borderColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  dotTextLatest: {
    fontFamily: Fonts.bold,
  },
  latestLabel: {
    fontFamily: Fonts.medium,
    fontSize: 9,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
})
