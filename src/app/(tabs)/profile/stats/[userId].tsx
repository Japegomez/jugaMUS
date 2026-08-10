import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BadgeList } from '@/components/stats/BadgeList'
import { ELOBadge } from '@/components/stats/ELOBadge'
import { FormBadges } from '@/components/stats/FormBadges'
import { PartnerList } from '@/components/stats/PartnerList'
import { RivalryList } from '@/components/stats/RivalryList'
import { StatsGrid } from '@/components/stats/StatsGrid'
import { PodiumSection } from '@/components/stats/TournamentPodiumSection'
import type { PodiumEntry } from '@/services/stats.service'
import { VenueList } from '@/components/stats/VenueList'
import { WinRateBar } from '@/components/stats/WinRateBar'
import { usePlayerStats } from '@/hooks/useStats'
import { formatStreak } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

export default function PlayerStatsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, isPending, isError, refetch } = usePlayerStats(userId)

  return (
    <View style={[styles.root, { paddingTop: screenTopPadding(insets.top) }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.closeWrap}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Estadísticas</Text>
          {data ? <ELOBadge rating={data.elo_rating} /> : null}
        </View>

        {isPending ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} /> : null}

        {isError ? (
          <Pressable onPress={() => void refetch()} style={styles.errorBox}>
            <Text style={styles.errorText}>No se pudieron cargar. Toca para reintentar.</Text>
          </Pressable>
        ) : null}

        {data ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumen</Text>
              <StatsGrid
                items={[
                  { label: 'Win rate', value: `${data.win_rate}%` },
                  { label: 'Partidas', value: String(data.matches_played) },
                  { label: 'Victorias', value: String(data.wins) },
                  { label: 'Derrotas', value: String(data.losses) },
                  { label: 'Racha', value: formatStreak(data.current_streak) },
                  { label: 'Mejor racha', value: String(data.best_win_streak) },
                ]}
              />
              <View style={styles.block}>
                <Text style={styles.blockLabel}>Forma reciente</Text>
                <FormBadges form={data.last_form} />
              </View>
              <WinRateBar winRate={data.win_rate} wins={data.wins} losses={data.losses} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Podio — Torneos y ligas</Text>
              <PodiumSection
                podium={data.podium}
                onPressEntry={(entry: PodiumEntry) => {
                  if (entry.source === 'league') {
                    router.push(`/(tabs)/leagues/${entry.id}` as Href)
                  } else {
                    router.push(`/(tabs)/tournaments/${entry.id}` as Href)
                  }
                }}
              />
              <Text style={styles.participations}>
                {`${data.tournaments_participated} torneos · ${data.leagues_participated} ligas`}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sitios</Text>
              <VenueList venues={data.venues} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Compañeros</Text>
              <PartnerList
                partners={data.partners}
                onPressPartner={(id) => router.push(`/(tabs)/profile/${id}` as Href)}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rivalidades</Text>
              <RivalryList
                nemesis={data.rivalries.nemesis}
                bestVictim={data.rivalries.best_victim}
                mostFaced={data.rivalries.most_faced}
                onPressRival={(id) => router.push(`/(tabs)/profile/${id}` as Href)}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Logros</Text>
              <BadgeList badges={data.badges} />
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/leaderboard' as Href)}
              style={styles.leaderboardBtn}
              accessibilityRole="button">
              <Text style={styles.leaderboardText}>Ver ranking ELO</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  closeWrap: { alignSelf: 'flex-end', padding: 8 },
  close: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  block: { gap: 6 },
  blockLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  participations: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
  },
  leaderboardBtn: {
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  leaderboardText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
})
