import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { CreateFab } from '@/components/ui/CreateFab'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StatusDot, type StatusDotTone } from '@/components/ui/StatusDot'
import { useAuthStore } from '@/hooks/useAuth'
import { useMyMatchesDashboard } from '@/hooks/useMatches'
import type { UserMatchSummary } from '@/services/matches.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { formatCityAndPlace } from '@/utils/location'

function matchLocation(row: Pick<UserMatchSummary, 'city' | 'place_defined' | 'place_text'>) {
  return formatCityAndPlace(row.city, row.place_defined ?? true, row.place_text)
}

function MatchListRow({
  title,
  location,
  startAt,
  tone,
  statusLabel,
  hint,
  onPress,
}: {
  title: string
  location: string
  startAt: string
  tone: StatusDotTone
  statusLabel: string
  hint?: string
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Partida: ${title}`}>
      <StatusDot tone={tone} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowMeta}>{location}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowStatus, tone === 'active' && styles.rowStatusActive]}>
          {statusLabel}
        </Text>
        <Text style={styles.rowDate}>{formatDisplay(startAt)}</Text>
      </View>
    </Pressable>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export default function MatchesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)
  const { data, isPending, isError, refetch, isRefetching } = useMyMatchesDashboard()

  const contentPadding = {
    paddingTop: screenTopPadding(insets.top, 16),
    paddingBottom: insets.bottom + 88,
  }

  const createFab = <CreateFab />

  if (!userId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.empty}>Inicia sesión para ver tus partidas.</Text>
      </View>
    )
  }

  if (isPending) {
    return (
      <View style={styles.container}>
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
        {createFab}
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <View style={[styles.centered, { flex: 1 }]}>
          <Text style={styles.empty}>No se pudieron cargar tus partidas.</Text>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
        {createFab}
      </View>
    )
  }

  const { upcoming, inProgress, awaitingResultValidation } = data
  const awaitingIds = new Set(awaitingResultValidation.map((m) => m.id))
  const inProgressDeduped = inProgress.filter((m) => !awaitingIds.has(m.id))
  const hasAny =
    upcoming.length > 0 || inProgressDeduped.length > 0 || awaitingResultValidation.length > 0

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, contentPadding]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }>
        <ScreenHeader title="Mis partidas" />

        {!hasAny ? (
          <Text style={styles.emptyBlock}>
            No tienes partidas activas aquí. Explora en Descubrir o crea una nueva.
          </Text>
        ) : null}

        {awaitingResultValidation.length > 0 ? (
          <Section title="Pendiente: validar resultado">
            {awaitingResultValidation.map((m) => (
              <MatchListRow
                key={m.id}
                title={m.title}
                location={matchLocation(m)}
                startAt={m.start_at}
                tone="pending"
                statusLabel="Pendiente"
                hint="Tienes que aprobar o disputar el marcador enviado por el rival."
                onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {inProgressDeduped.length > 0 ? (
          <Section title="En curso">
            {inProgressDeduped.map((m) => (
              <MatchListRow
                key={m.id}
                title={m.title}
                location={matchLocation(m)}
                startAt={m.start_at}
                tone="active"
                statusLabel="En curso"
                onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {upcoming.length > 0 ? (
          <Section title="Próximas">
            {upcoming.map((m) => (
              <MatchListRow
                key={m.id}
                title={m.title}
                location={matchLocation(m)}
                startAt={m.start_at}
                tone="upcoming"
                statusLabel="Próxima"
                onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
      {createFab}
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.warning,
    marginTop: 4,
    lineHeight: 16,
  },
  rowTrailing: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 96 },
  rowStatus: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  rowStatusActive: {
    color: Colors.primary,
  },
  rowDate: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  empty: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyBlock: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retry: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
})
