import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  BADGE_CATALOG,
  BADGE_LABELS,
  type PlayerBadge,
} from '@/services/stats.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

const COLLAPSED_COUNT = 4

function formatEarnedAt(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function BadgeList({ badges }: { badges: PlayerBadge[] }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const earnedByKey = useMemo(() => new Map(badges.map((b) => [b.key, b])), [badges])

  const ordered = useMemo(() => {
    const earned = BADGE_CATALOG.filter((b) => earnedByKey.has(b.key))
    const locked = BADGE_CATALOG.filter((b) => !earnedByKey.has(b.key))
    return [...earned, ...locked]
  }, [earnedByKey])

  const total = BADGE_CATALOG.length
  const earnedCount = BADGE_CATALOG.filter((b) => earnedByKey.has(b.key)).length
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT)
  const canToggle = ordered.length > COLLAPSED_COUNT

  return (
    <View style={styles.wrap}>
      <Text style={styles.progress}>{`${earnedCount} de ${total} logros`}</Text>

      <View style={styles.grid}>
        {visible.map((meta) => {
          const earned = earnedByKey.get(meta.key)
          const locked = !earned
          const active = selectedKey === meta.key
          return (
            <Pressable
              key={meta.key}
              onPress={() => setSelectedKey(active ? null : meta.key)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                locked ? styles.cardLocked : styles.cardEarned,
                active && styles.cardActive,
                pressed && styles.cardPressed,
              ]}>
              <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
                <Text style={[styles.icon, locked && styles.iconLocked]}>{meta.emoji}</Text>
              </View>
              <Text style={[styles.title, locked && styles.titleLocked]} numberOfLines={2}>
                {BADGE_LABELS[meta.key] ?? meta.key}
              </Text>
              {active ? (
                <Text style={styles.hint}>{meta.hint}</Text>
              ) : earned ? (
                <Text style={styles.earnedAt}>{formatEarnedAt(earned.earned_at)}</Text>
              ) : (
                <Text style={styles.lockedTag}>Bloqueado</Text>
              )}
            </Pressable>
          )
        })}
      </View>

      {canToggle ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.toggleBtnPressed]}>
          <Text style={styles.toggleText}>{expanded ? 'Ver menos' : 'Ver más'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  progress: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1.5,
  },
  cardEarned: {
    backgroundColor: Colors.wonBackground,
    borderColor: Colors.primary,
  },
  cardLocked: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    opacity: 0.72,
  },
  cardActive: {
    borderColor: Colors.primary,
    borderWidth: 2.5,
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: 2,
  },
  iconWrapLocked: {
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  icon: {
    fontSize: 22,
  },
  iconLocked: {
    opacity: 0.45,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  titleLocked: {
    color: Colors.textSecondary,
    fontFamily: Fonts.semiBold,
  },
  earnedAt: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.primary,
  },
  hint: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  lockedTag: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggleBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnPressed: {
    opacity: 0.85,
  },
  toggleText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
})
