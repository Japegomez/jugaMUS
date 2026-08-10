import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { RivalStat } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function RivalRow({
  label,
  rival,
  onPress,
  isLast,
}: {
  label: string
  rival: RivalStat | null
  onPress?: (userId: string) => void
  isLast?: boolean
}) {
  if (!rival) {
    return (
      <View style={[styles.row, isLast && styles.rowLast]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.empty}>—</Text>
      </View>
    )
  }

  const body = (
    <>
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {rival.display_name}
        </Text>
      </View>
      <Text style={styles.record}>{`${rival.wins}–${rival.losses}`}</Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(rival.user_id)}
        style={[styles.row, isLast && styles.rowLast]}>
        {body}
      </Pressable>
    )
  }

  return <View style={[styles.row, isLast && styles.rowLast]}>{body}</View>
}

export function RivalryList({
  nemesis,
  bestVictim,
  mostFaced,
  onPressRival,
}: {
  nemesis: RivalStat | null
  bestVictim: RivalStat | null
  mostFaced: RivalStat | null
  onPressRival?: (userId: string) => void
}) {
  return (
    <View>
      <RivalRow label="Némesis" rival={nemesis} onPress={onPressRival} />
      <RivalRow label="Víctima favorita" rival={bestVictim} onPress={onPressRival} />
      <RivalRow label="Más enfrentado" rival={mostFaced} onPress={onPressRival} isLast />
    </View>
  )
}

const styles = StyleSheet.create({
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
  label: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  name: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  record: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
})
