import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { TournamentPodium, TournamentPodiumEntry } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const MEDAL = {
  gold: { emoji: '🥇', label: 'Oro', color: '#B8860B' },
  silver: { emoji: '🥈', label: 'Plata', color: '#8A8A8A' },
  bronze: { emoji: '🥉', label: 'Bronce', color: '#A0622E' },
} as const

function MedalBadge({
  kind,
  count,
  compact,
}: {
  kind: keyof typeof MEDAL
  count: number
  compact?: boolean
}) {
  const meta = MEDAL[kind]
  return (
    <View style={[styles.medalBadge, compact && styles.medalBadgeCompact]}>
      <Text style={styles.medalEmoji}>{meta.emoji}</Text>
      <Text style={[styles.medalCount, { color: meta.color }]}>{count}</Text>
      {!compact ? <Text style={styles.medalLabel}>{meta.label}</Text> : null}
    </View>
  )
}

function formatTournamentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function PodiumList({
  kind,
  entries,
  onPressTournament,
}: {
  kind: keyof typeof MEDAL
  entries: TournamentPodiumEntry[]
  onPressTournament?: (tournamentId: string) => void
}) {
  const meta = MEDAL[kind]

  if (!entries.length) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>{meta.emoji}</Text>
          <Text style={styles.sectionTitle}>{meta.label}</Text>
        </View>
        <Text style={styles.empty}>Sin torneos en podio</Text>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>{meta.emoji}</Text>
        <Text style={styles.sectionTitle}>{meta.label}</Text>
      </View>
      {entries.map((entry, index) => {
        const row = (
          <>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <Text style={styles.rowMeta}>{formatTournamentDate(entry.start_at)}</Text>
            </View>
          </>
        )

        return onPressTournament ? (
          <Pressable
            key={entry.tournament_id}
            onPress={() => onPressTournament(entry.tournament_id)}
            style={[styles.row, index === entries.length - 1 && styles.rowLast]}>
            {row}
          </Pressable>
        ) : (
          <View
            key={entry.tournament_id}
            style={[styles.row, index === entries.length - 1 && styles.rowLast]}>
            {row}
          </View>
        )
      })}
    </View>
  )
}

export function TournamentMedalsRow({ podium }: { podium: TournamentPodium }) {
  return (
    <View style={styles.medalsRow}>
      <MedalBadge kind="gold" count={podium.gold.length} compact />
      <MedalBadge kind="silver" count={podium.silver.length} compact />
      <MedalBadge kind="bronze" count={podium.bronze.length} compact />
    </View>
  )
}

export function TournamentPodiumSection({
  podium,
  onPressTournament,
  showMedalCounts = true,
}: {
  podium: TournamentPodium
  onPressTournament?: (tournamentId: string) => void
  showMedalCounts?: boolean
}) {
  const total = podium.gold.length + podium.silver.length + podium.bronze.length

  if (total === 0 && !showMedalCounts) {
    return <Text style={styles.emptyBlock}>Aún no hay podios en torneos</Text>
  }

  return (
    <View style={styles.wrap}>
      {showMedalCounts ? (
        <View style={styles.medalsRowExpanded}>
          <MedalBadge kind="gold" count={podium.gold.length} />
          <MedalBadge kind="silver" count={podium.silver.length} />
          <MedalBadge kind="bronze" count={podium.bronze.length} />
        </View>
      ) : null}
      <PodiumList kind="gold" entries={podium.gold} onPressTournament={onPressTournament} />
      <PodiumList kind="silver" entries={podium.silver} onPressTournament={onPressTournament} />
      <PodiumList kind="bronze" entries={podium.bronze} onPressTournament={onPressTournament} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  medalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  medalsRowExpanded: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
    paddingBottom: 4,
  },
  medalBadge: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  medalBadgeCompact: {
    flexDirection: 'row',
    gap: 4,
    flex: 0,
  },
  medalEmoji: {
    fontSize: 22,
  },
  medalCount: {
    fontFamily: Fonts.bold,
    fontSize: 18,
  },
  medalLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionEmoji: {
    fontSize: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    paddingVertical: 4,
  },
  emptyBlock: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
