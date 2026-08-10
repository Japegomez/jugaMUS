import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { ELOBadge } from '@/components/stats/ELOBadge'
import { FormBadges } from '@/components/stats/FormBadges'
import { StatsGrid } from '@/components/stats/StatsGrid'
import { WinRateBar } from '@/components/stats/WinRateBar'
import { usePlayerStats } from '@/hooks/useStats'
import { formatStreak } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function ProfileStatsCard({
  userId,
  onPressDetails,
}: {
  userId: string
  onPressDetails: () => void
}) {
  const { data, isPending, isError } = usePlayerStats(userId)

  if (isPending) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estadísticas</Text>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !data) {
    return null
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Estadísticas</Text>
        <ELOBadge rating={data.elo_rating} />
      </View>

      <StatsGrid
        items={[
          { label: 'Win rate', value: `${data.win_rate}%` },
          { label: 'Partidas', value: String(data.matches_played) },
          { label: 'Victorias', value: String(data.wins) },
          { label: 'Racha', value: formatStreak(data.current_streak) },
        ]}
      />

      <View style={styles.formBlock}>
        <Text style={styles.formLabel}>Forma reciente</Text>
        <FormBadges form={data.last_form} />
      </View>

      <WinRateBar winRate={data.win_rate} wins={data.wins} losses={data.losses} />

      <Pressable onPress={onPressDetails} accessibilityRole="button" style={styles.linkBtn}>
        <Text style={styles.linkText}>Ver estadísticas</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formBlock: {
    gap: 6,
  },
  formLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
})
