import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { ELOBadge } from '@/components/stats/ELOBadge'
import { FormBadges } from '@/components/stats/FormBadges'
import { HeadToHeadCard } from '@/components/stats/HeadToHeadCard'
import { useMatchInsights } from '@/hooks/useStats'
import { formatStreak } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

export function MatchInsightsSection({ matchId }: { matchId: string }) {
  const { data, isPending, isError } = useMatchInsights(matchId)
  const [expanded, setExpanded] = useState(true)

  if (isPending) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !data || data.players.length === 0) {
    return null
  }

  const teamA = data.players.filter((p) => p.team === 'A')
  const teamB = data.players.filter((p) => p.team === 'B')

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Estadísticas del enfrentamiento</Text>
        <Text style={styles.toggle}>{expanded ? 'Ocultar' : 'Ver'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.card}>
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              {teamA.map((p) => (
                <View key={p.user_id} style={styles.playerBlock}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.display_name}
                  </Text>
                  <View style={styles.playerMeta}>
                    <ELOBadge rating={p.elo_rating} />
                    <Text style={styles.metaText}>{`${p.win_rate}%`}</Text>
                    <Text style={styles.metaText}>{formatStreak(p.current_streak)}</Text>
                  </View>
                  <FormBadges form={p.last_form} />
                </View>
              ))}
            </View>
            <View style={styles.teamCol}>
              {teamB.map((p) => (
                <View key={p.user_id} style={styles.playerBlock}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.display_name}
                  </Text>
                  <View style={styles.playerMeta}>
                    <ELOBadge rating={p.elo_rating} />
                    <Text style={styles.metaText}>{`${p.win_rate}%`}</Text>
                    <Text style={styles.metaText}>{formatStreak(p.current_streak)}</Text>
                  </View>
                  <FormBadges form={p.last_form} />
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.subTitle}>Head to head</Text>
          <HeadToHeadCard
            players={data.players}
            individual={data.individual_h2h}
            pair={data.pair_h2h}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggle: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  teamsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  teamCol: {
    flex: 1,
    gap: 12,
  },
  playerBlock: {
    gap: 6,
  },
  playerName: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  playerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  subTitle: {
    marginTop: 16,
    marginBottom: 6,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})
