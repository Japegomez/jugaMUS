import { StyleSheet, Text, View } from 'react-native'

import type { VenueStat } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function venueLabel(venue: VenueStat): string {
  if (venue.place_text) return `${venue.city} · ${venue.place_text}`
  return venue.city || 'Sin lugar'
}

export function VenueList({ venues }: { venues: VenueStat[] }) {
  if (!venues.length) {
    return <Text style={styles.empty}>Sin sitios registrados</Text>
  }

  return (
    <View style={styles.list}>
      {venues.map((venue, index) => (
        <View
          key={`${venue.city}-${venue.place_text ?? ''}-${index}`}
          style={[styles.row, index === venues.length - 1 && styles.rowLast]}>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {venueLabel(venue)}
            </Text>
            <Text style={styles.meta}>{`${venue.matches} partidas`}</Text>
          </View>
          <Text style={styles.rate}>{`${venue.win_rate}%`}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  meta: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rate: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
