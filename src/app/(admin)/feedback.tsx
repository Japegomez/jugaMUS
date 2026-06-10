import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { AdminCloseBar } from '@/components/admin/AdminCloseBar'
import { useFeedbackList } from '@/hooks/useAdmin'
import type { AdminFeedback } from '@/services/admin.service'
import type { FeedbackListFilters } from '@/services/admin.service'
import { FEEDBACK_CATEGORIES, feedbackCategoryLabel } from '@/services/feedback.service'
import type { FeedbackCategory } from '@/services/feedback.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type CategoryFilter = FeedbackListFilters['category']

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function categoryBadgeStyle(category: FeedbackCategory) {
  switch (category) {
    case 'issue':
      return styles.badgeIssue
    case 'feature':
      return styles.badgeFeature
    default:
      return styles.badgeOther
  }
}

function FeedbackRow({ item }: { item: AdminFeedback }) {
  const dateStr = new Date(item.created_at).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const category = item.category as FeedbackCategory

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.badge, categoryBadgeStyle(category)]}>
          {feedbackCategoryLabel(category)}
        </Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.meta}>
        {item.user_display_name ?? 'Usuario'} · {dateStr}
      </Text>
    </View>
  )
}

export default function AdminFeedbackScreen() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const filters = useMemo<FeedbackListFilters>(
    () => ({ category: categoryFilter }),
    [categoryFilter]
  )

  const { data: feedbackList, isLoading, isError, refetch, isRefetching } = useFeedbackList(filters)

  return (
    <View style={styles.container}>
      <AdminCloseBar />
      <View style={styles.filters}>
        <Text style={styles.screenTitle}>Feedback</Text>
        <Text style={styles.filterLabel}>Categoría</Text>
        <View style={styles.chipRow}>
          <FilterChip
            label="Todas"
            active={categoryFilter === 'all'}
            onPress={() => setCategoryFilter('all')}
          />
          {FEEDBACK_CATEGORIES.map((item) => (
            <FilterChip
              key={item.value}
              label={item.label}
              active={categoryFilter === item.value}
              onPress={() => setCategoryFilter(item.value)}
            />
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : isError ? (
        <Text style={styles.errorText}>No se pudo cargar el feedback.</Text>
      ) : (
        <FlatList
          data={feedbackList ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedbackRow item={item} />}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListEmptyComponent={<Text style={styles.empty}>No hay feedback con estos filtros.</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filters: {
    padding: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  screenTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  chipTextActive: {
    color: Colors.white,
  },
  loader: { marginTop: 32 },
  errorText: {
    textAlign: 'center',
    color: Colors.danger,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  badge: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeIssue: {
    backgroundColor: '#fde8e8',
    color: Colors.danger,
  },
  badgeFeature: {
    backgroundColor: '#e6f4ef',
    color: Colors.primary,
  },
  badgeOther: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
  },
  message: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
