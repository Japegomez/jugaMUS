import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { UserMatchSummary } from '@/services/matches.service'
import { displayMatchTitle, matchHistoryBackground, matchStatusDisplay } from '@/utils/matchDisplay'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const VISIBLE_ROWS = 5
const ROW_HEIGHT = 58

type MatchHistoryListProps = {
  matches: UserMatchSummary[] | undefined
  loading?: boolean
  emptyMessage?: string
  onMatchPress: (matchId: string) => void
}

export function MatchHistoryList({
  matches,
  loading,
  emptyMessage = 'Sin partidas en el historial',
  onMatchPress,
}: MatchHistoryListProps) {
  if (loading && !matches) {
    return <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
  }

  if (!matches || matches.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>
  }

  return (
    <View style={styles.list}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={matches.length > VISIBLE_ROWS}>
        {matches.map((m, index) => (
          <MatchHistoryRow
            key={m.id}
            match={m}
            isLast={index === matches.length - 1}
            onPress={() => onMatchPress(m.id)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function MatchHistoryRow({
  match,
  isLast,
  onPress,
}: {
  match: UserMatchSummary
  isLast: boolean
  onPress: () => void
}) {
  const status = matchStatusDisplay(match)
  const outcomeBg = matchHistoryBackground(match.outcome ?? null)
  const dateStr = new Date(match.start_at).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const outcomeHint =
    match.outcome === 'won' ? ', victoria' : match.outcome === 'lost' ? ', derrota' : ''

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isLast && styles.rowLast,
        outcomeBg != null && { backgroundColor: outcomeBg },
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayMatchTitle(match)}${outcomeHint}`}>
      <View style={styles.rowMain}>
        <Text style={styles.title} numberOfLines={1}>
          {displayMatchTitle(match)}
        </Text>
        <Text style={styles.meta}>
          {dateStr} · {match.city}
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: status.color }]}>
        <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  loader: { marginVertical: 12 },
  empty: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  list: {
    marginHorizontal: -16,
    marginBottom: -4,
    overflow: 'hidden',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  scroll: {
    maxHeight: VISIBLE_ROWS * ROW_HEIGHT,
  },
  scrollContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: { opacity: 0.7 },
  rowMain: { flex: 1 },
  title: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontFamily: Fonts.semiBold },
})
