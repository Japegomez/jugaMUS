import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { ELOBadge } from '@/components/stats/ELOBadge'
import { PodiumMedalsRow } from '@/components/stats/TournamentPodiumSection'
import { usePlayerStats } from '@/hooks/useStats'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function ProfileStatsCard({
  userId,
  onPressDetails,
}: {
  userId: string
  onPressDetails: () => void
}) {
  const { data, isPending, isError, refetch } = usePlayerStats(userId)

  if (isPending) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estadísticas</Text>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estadísticas</Text>
        <Text style={styles.errorText}>No se pudieron cargar las estadísticas.</Text>
        <Pressable
          onPress={() => void refetch()}
          accessibilityRole="button"
          style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  const medalTotal = data.podium.gold.length + data.podium.silver.length + data.podium.bronze.length

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Estadísticas</Text>
        <ELOBadge rating={data.elo_rating} />
      </View>

      <View style={styles.winRateBlock}>
        <Text style={styles.winRateValue}>{data.win_rate}%</Text>
        <Text style={styles.winRateLabel}>Win rate</Text>
        <Text style={styles.matchesMeta}>
          {`${data.wins}V · ${data.losses}D · ${data.matches_played} partidas`}
        </Text>
      </View>

      <View style={styles.medalsBlock}>
        <Text style={styles.medalsLabel}>Podio</Text>
        {medalTotal > 0 ? (
          <PodiumMedalsRow podium={data.podium} />
        ) : (
          <Text style={styles.medalsEmpty}>Sin medallas aún</Text>
        )}
      </View>

      <Pressable
        onPress={onPressDetails}
        accessibilityRole="button"
        style={({ pressed }) => [styles.detailsBtn, pressed && styles.detailsBtnPressed]}>
        <Text style={styles.detailsBtnText}>Ver estadísticas detalladas</Text>
        <Text style={styles.detailsBtnChevron}>›</Text>
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
    gap: 14,
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
  winRateBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  winRateValue: {
    fontFamily: Fonts.bold,
    fontSize: 40,
    color: Colors.primary,
    lineHeight: 44,
  },
  winRateLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  matchesMeta: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  medalsBlock: {
    gap: 8,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  medalsLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  medalsEmpty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 4,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  detailsBtnPressed: {
    opacity: 0.85,
  },
  detailsBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
  detailsBtnChevron: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    color: Colors.white,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  retryText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
})
