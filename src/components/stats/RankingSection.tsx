import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { usePlayerRanking } from '@/hooks/useStats'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

function formatRank(rank: number | null | undefined, total?: number | null): string {
  if (rank == null || rank <= 0) return '—'
  if (total != null && total > 0) return `#${rank} / ${total}`
  return `#${rank}`
}

export function RankingSection({
  userId,
  onPressRanking,
  statsReady,
}: {
  userId: string
  onPressRanking: () => void
  statsReady: boolean
}) {
  const { data, isPending, isError } = usePlayerRanking(userId, { enabled: statsReady })

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Ranking</Text>

      {isPending || !statsReady ? <ActivityIndicator color={Colors.primary} /> : null}

      {statsReady && isError ? (
        <Text style={styles.empty}>No se pudo cargar el ranking.</Text>
      ) : null}

      {statsReady && !isPending && !isError && data ? (
        <View style={styles.rows}>
          {data.city ? (
            <View style={styles.row}>
              <Text style={styles.label} numberOfLines={1}>
                {data.city}
              </Text>
              <Text style={styles.value}>{formatRank(data.city_rank, data.city_total)}</Text>
            </View>
          ) : (
            <Text style={styles.empty}>Sin ciudad para el ranking local</Text>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Global</Text>
            <Text style={styles.value}>{formatRank(data.global_rank, data.global_total)}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={onPressRanking}
        accessibilityRole="button"
        style={({ pressed }) => [styles.rankingBtn, pressed && styles.rankingBtnPressed]}>
        <Text style={styles.rankingBtnText}>Ranking</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  value: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.primary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  rankingBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  rankingBtnPressed: {
    opacity: 0.85,
  },
  rankingBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
})
