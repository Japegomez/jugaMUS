import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { PartnerStat } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function PartnerList({
  partners,
  onPressPartner,
}: {
  partners: PartnerStat[]
  onPressPartner?: (userId: string) => void
}) {
  if (!partners.length) {
    return <Text style={styles.empty}>Sin compañeros registrados</Text>
  }

  return (
    <View>
      {partners.map((partner, index) => {
        const content = (
          <>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {partner.display_name}
              </Text>
              <Text style={styles.meta}>
                {`${partner.matches} juntas · ${partner.wins}G · ${partner.win_rate}%`}
              </Text>
            </View>
          </>
        )

        return onPressPartner ? (
          <Pressable
            key={partner.user_id}
            onPress={() => onPressPartner(partner.user_id)}
            style={[styles.row, index === partners.length - 1 && styles.rowLast]}>
            {content}
          </Pressable>
        ) : (
          <View
            key={partner.user_id}
            style={[styles.row, index === partners.length - 1 && styles.rowLast]}>
            {content}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  info: {
    flex: 1,
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
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
