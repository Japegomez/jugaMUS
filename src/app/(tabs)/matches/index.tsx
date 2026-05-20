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

import { useAuthStore } from '@/hooks/useAuth'
import { useMyMatchesDashboard } from '@/hooks/useMatches'
import type { AwaitingResultMatchRow, UserMatchSummary } from '@/services/matches.service'
import type { UserTournamentSummary } from '@/services/tournaments.service'
import { TOURNAMENT_STATUS } from '@/constants'
import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { CreateFab } from '@/components/ui/CreateFab'
import { formatCityAndPlace } from '@/utils/location'

function MatchRowCard({
  row,
  subtitle,
  onPress,
}: {
  row: UserMatchSummary | AwaitingResultMatchRow
  subtitle?: string
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Partida: ${row.title}`}>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {row.title}
      </Text>
      <Text style={styles.cardMeta}>{formatDisplay(row.start_at)}</Text>
      <Text style={styles.cardMeta}>{row.city}</Text>
      {subtitle ? <Text style={styles.cardHint}>{subtitle}</Text> : null}
    </Pressable>
  )
}

function TournamentRowCard({
  row,
  subtitle,
  onPress,
}: {
  row: UserTournamentSummary
  subtitle?: string
  onPress: () => void
}) {
  const statusLabel =
    row.status === TOURNAMENT_STATUS.REGISTRATION
      ? row.bracket_generated_at
        ? 'Inscripción'
        : 'Inscripción abierta'
      : row.status === TOURNAMENT_STATUS.IN_PROGRESS
        ? 'En curso'
        : row.status

  return (
    <Pressable
      style={[styles.card, styles.tournamentCard]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Torneo: ${row.title}`}>
      <Text style={styles.tournamentKind}>Torneo</Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {row.title}
      </Text>
      <Text style={styles.cardMeta}>{formatDisplay(row.start_at)}</Text>
      <Text style={styles.cardMeta}>
        {formatCityAndPlace(row.city, row.place_defined, row.place_text)}
      </Text>
      {subtitle ? <Text style={styles.cardHint}>{subtitle}</Text> : null}
      <Text style={styles.tournamentStatus}>{statusLabel}</Text>
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
  const { data, isLoading, isError, refetch, isRefetching } = useMyMatchesDashboard()

  if (!userId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.empty}>Inicia sesión para ver tus partidas.</Text>
      </View>
    )
  }

  const createFab = <CreateFab />

  if (isLoading) {
    return (
      <View style={styles.root}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color="#1a5f4a" />
        </View>
        {createFab}
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={styles.root}>
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.empty}>No se pudieron cargar tus partidas.</Text>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
        {createFab}
      </View>
    )
  }

  const {
    upcoming,
    inProgress,
    awaitingResultValidation,
    upcomingTournaments,
    inProgressTournaments,
  } = data
  const awaitingIds = new Set(awaitingResultValidation.map((m) => m.id))
  const inProgressDeduped = inProgress.filter((m) => !awaitingIds.has(m.id))
  const hasAny =
    upcoming.length > 0 ||
    inProgressDeduped.length > 0 ||
    awaitingResultValidation.length > 0 ||
    upcomingTournaments.length > 0 ||
    inProgressTournaments.length > 0

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom + 88 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }>
        <Text style={styles.screenTitle}>Mis partidas</Text>
        <Text style={styles.screenSubtitle}>
          Próximas fechas, torneos, partidas en curso y acciones pendientes. El historial está en
          Perfil.
        </Text>

        {!hasAny ? (
          <Text style={styles.emptyBlock}>
            No tienes partidas ni torneos activos aquí. Explora en Descubrir o crea uno nuevo.
          </Text>
        ) : null}

        {inProgressTournaments.length > 0 ? (
          <Section title="Torneos en curso">
            {inProgressTournaments.map((t) => (
              <TournamentRowCard
                key={t.id}
                row={t}
                subtitle={t.isOrganizer ? 'Organizas este torneo' : 'Participas en este torneo'}
                onPress={() => router.push(`/(tabs)/tournaments/${t.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {upcomingTournaments.length > 0 ? (
          <Section title="Torneos próximos">
            {upcomingTournaments.map((t) => (
              <TournamentRowCard
                key={t.id}
                row={t}
                subtitle={
                  t.isOrganizer
                    ? t.bracket_generated_at
                      ? 'Organizas este torneo'
                      : 'Organizas este torneo · cuadro pendiente de generar'
                    : 'Participas en este torneo'
                }
                onPress={() => router.push(`/(tabs)/tournaments/${t.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {awaitingResultValidation.length > 0 ? (
          <Section title="Pendiente: validar resultado">
            {awaitingResultValidation.map((m) => (
              <MatchRowCard
                key={m.id}
                row={m}
                subtitle="Tienes que aprobar o disputar el marcador enviado por el rival."
                onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {inProgressDeduped.length > 0 ? (
          <Section title="En curso">
            {inProgressDeduped.map((m) => (
              <MatchRowCard
                key={m.id}
                row={m}
                onPress={() => router.push(`/(tabs)/matches/${m.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {upcoming.length > 0 ? (
          <Section title="Próximas">
            {upcoming.map((m) => (
              <MatchRowCard
                key={m.id}
                row={m}
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
  root: { flex: 1, backgroundColor: '#f6f7f4' },
  scroll: { flex: 1, backgroundColor: '#f6f7f4' },
  scrollContent: { paddingHorizontal: 20 },
  container: { flex: 1, backgroundColor: '#f6f7f4' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  screenSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a5f4a',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  tournamentCard: { borderColor: '#c5ddd4' },
  tournamentKind: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a5f4a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tournamentStatus: { fontSize: 12, color: '#1a5f4a', fontWeight: '600', marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  cardMeta: { fontSize: 13, color: '#666', marginTop: 4 },
  cardHint: { fontSize: 12, color: '#c07000', marginTop: 8, fontStyle: 'italic' },
  empty: { fontSize: 15, color: '#888', textAlign: 'center' },
  emptyBlock: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retry: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
})
