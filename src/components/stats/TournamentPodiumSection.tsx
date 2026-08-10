import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Podium, PodiumEntry, PodiumSource } from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const MEDAL = {
  gold: { emoji: '🥇', label: 'Oro', color: '#B8860B', bg: '#FFF8E1' },
  silver: { emoji: '🥈', label: 'Plata', color: '#8A8A8A', bg: '#F5F5F5' },
  bronze: { emoji: '🥉', label: 'Bronce', color: '#A0622E', bg: '#FFF0E8' },
} as const

const PODIUM_HEIGHTS = {
  gold: 116,
  silver: 96,
  bronze: 78,
} as const

const PODIUM_HEIGHTS_COMPACT = {
  gold: 88,
  silver: 72,
  bronze: 58,
} as const

const SOURCE_LABEL: Record<PodiumSource, string> = {
  tournament: 'Torneo',
  league: 'Liga',
}

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

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function SourceChip({ source }: { source: PodiumSource }) {
  return (
    <View style={[styles.sourceChip, source === 'league' && styles.sourceChipLeague]}>
      <Text style={styles.sourceChipText}>{SOURCE_LABEL[source]}</Text>
    </View>
  )
}

function PodiumStep({
  kind,
  count,
  compact,
}: {
  kind: keyof typeof MEDAL
  count: number
  compact?: boolean
}) {
  const meta = MEDAL[kind]
  const heights = compact ? PODIUM_HEIGHTS_COMPACT : PODIUM_HEIGHTS
  const height = heights[kind]
  const stepWidth = compact ? 72 : 90

  return (
    <View style={[styles.podiumStep, { width: stepWidth }]}>
      <View
        style={[
          styles.podiumBase,
          { height, backgroundColor: meta.bg, borderColor: meta.color },
          compact && styles.podiumBaseCompact,
        ]}>
        <Text style={[styles.podiumEmoji, compact && styles.podiumEmojiCompact]}>
          {meta.emoji}
        </Text>
        <Text style={[styles.podiumCount, { color: meta.color }, compact && styles.podiumCountCompact]}>
          {count}
        </Text>
      </View>
      <Text style={[styles.podiumLabel, compact && styles.podiumLabelCompact]}>{meta.label}</Text>
    </View>
  )
}

export function VisualPodium({
  podium,
  compact,
}: {
  podium: Podium
  compact?: boolean
}) {
  const gold = podium.gold.length
  const silver = podium.silver.length
  const bronze = podium.bronze.length

  return (
    <View style={[styles.podiumWrap, compact && styles.podiumWrapCompact]}>
      <View style={styles.podiumRow}>
        <PodiumStep kind="silver" count={silver} compact={compact} />
        <PodiumStep kind="gold" count={gold} compact={compact} />
        <PodiumStep kind="bronze" count={bronze} compact={compact} />
      </View>
    </View>
  )
}

function PodiumList({
  kind,
  entries,
  onPressEntry,
}: {
  kind: keyof typeof MEDAL
  entries: PodiumEntry[]
  onPressEntry?: (entry: PodiumEntry) => void
}) {
  const meta = MEDAL[kind]

  if (!entries.length) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>{meta.emoji}</Text>
          <Text style={styles.sectionTitle}>{meta.label}</Text>
        </View>
        <Text style={styles.empty}>Sin podios</Text>
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
          <View style={styles.rowContent}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <Text style={styles.rowMeta}>{formatEventDate(entry.start_at)}</Text>
            </View>
            <SourceChip source={entry.source} />
          </View>
        )

        return onPressEntry ? (
          <Pressable
            key={`${entry.source}-${entry.id}`}
            onPress={() => onPressEntry(entry)}
            style={[styles.row, index === entries.length - 1 && styles.rowLast]}>
            {row}
          </Pressable>
        ) : (
          <View
            key={`${entry.source}-${entry.id}`}
            style={[styles.row, index === entries.length - 1 && styles.rowLast]}>
            {row}
          </View>
        )
      })}
    </View>
  )
}

export function PodiumMedalsRow({ podium }: { podium: Podium }) {
  return (
    <View style={styles.medalsRow}>
      <MedalBadge kind="gold" count={podium.gold.length} compact />
      <MedalBadge kind="silver" count={podium.silver.length} compact />
      <MedalBadge kind="bronze" count={podium.bronze.length} compact />
    </View>
  )
}

/** @deprecated Use PodiumMedalsRow */
export const TournamentMedalsRow = PodiumMedalsRow

export function PodiumSection({
  podium,
  onPressEntry,
  showMedalCounts = true,
}: {
  podium: Podium
  onPressEntry?: (entry: PodiumEntry) => void
  showMedalCounts?: boolean
}) {
  const total = podium.gold.length + podium.silver.length + podium.bronze.length

  if (total === 0 && !showMedalCounts) {
    return <Text style={styles.emptyBlock}>Aún no hay podios en torneos ni ligas</Text>
  }

  return (
    <View style={styles.wrap}>
      {showMedalCounts ? <VisualPodium podium={podium} /> : null}
      <PodiumList kind="gold" entries={podium.gold} onPressEntry={onPressEntry} />
      <PodiumList kind="silver" entries={podium.silver} onPressEntry={onPressEntry} />
      <PodiumList kind="bronze" entries={podium.bronze} onPressEntry={onPressEntry} />
    </View>
  )
}

/** @deprecated Use PodiumSection */
export const TournamentPodiumSection = PodiumSection

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  medalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
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
  // ── Visual podium ──
  podiumWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  podiumWrapCompact: {
    paddingVertical: 4,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  podiumStep: {
    alignItems: 'center',
    width: 90,
  },
  podiumBase: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  podiumBaseCompact: {
    borderWidth: 1,
    paddingTop: 7,
    paddingBottom: 4,
  },
  podiumEmoji: {
    fontSize: 26,
  },
  podiumEmojiCompact: {
    fontSize: 20,
  },
  podiumCount: {
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
  podiumCountCompact: {
    fontSize: 16,
  },
  podiumLabel: {
    marginTop: 4,
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  podiumLabelCompact: {
    marginTop: 2,
    fontSize: 10,
  },
  // ── Lists ──
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
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  sourceChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  sourceChipLeague: {
    backgroundColor: Colors.border,
  },
  sourceChipText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
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
