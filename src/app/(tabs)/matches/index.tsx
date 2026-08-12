import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { CreateFab } from '@/components/ui/CreateFab'
import { Button } from '@/components/ui/Button'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StatusDot, type StatusDotTone } from '@/components/ui/StatusDot'
import { MATCH_STATUS, TOURNAMENT_STATUS } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { useMyMatchesDashboard } from '@/hooks/useMatches'
import { useMyMatchInvitations, useRespondMatchInvitation } from '@/hooks/useMatchInvitations'
import type { MyMatchesDashboard } from '@/services/matches.service'
import type { MyMatchInvitationRow } from '@/services/matchInvitations.service'
import type { UserTournamentSummary } from '@/services/tournaments.service'
import { leagueFormatDisplay, leagueStatusDisplay } from '@/utils/leagueDisplay'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { formatCityAndPlace } from '@/utils/location'

type LocationFields = {
  city: string | null
  place_defined?: boolean | null
  place_text?: string | null
}

function matchLocation(row: LocationFields) {
  return formatCityAndPlace(row.city ?? '', row.place_defined ?? true, row.place_text)
}

function MatchListRow({
  title,
  location,
  startAt,
  tone,
  statusLabel,
  hint,
  hintTone = 'warning',
  kindLabel,
  accessibilityKind,
  onPress,
}: {
  title: string
  location: string
  startAt: string
  tone: StatusDotTone
  statusLabel: string
  hint?: string
  hintTone?: 'warning' | 'info'
  kindLabel?: string
  accessibilityKind: string
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityKind}: ${title}`}>
      <StatusDot tone={tone} />
      <View style={styles.rowBody}>
        {kindLabel ? <Text style={styles.rowKind}>{kindLabel}</Text> : null}
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowMeta}>{location}</Text>
        {hint ? (
          <Text style={[styles.rowHint, hintTone === 'info' && styles.rowHintInfo]}>{hint}</Text>
        ) : null}
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

type MatchesListItem =
  | { key: string; kind: 'empty' }
  | { key: string; kind: 'section'; title: string }
  | {
      key: string
      kind: 'invitation'
      invitation: MyMatchInvitationRow
    }
  | {
      key: string
      kind: 'row'
      title: string
      location: string
      startAt: string
      tone: StatusDotTone
      statusLabel: string
      hint?: string
      hintTone?: 'warning' | 'info'
      kindLabel?: string
      href: string
      accessibilityKind: string
    }

function tournamentStatusLabel(t: UserTournamentSummary): string {
  if (t.status === TOURNAMENT_STATUS.IN_PROGRESS) return 'En curso'
  if (t.bracket_generated_at) return 'Inscripción'
  return 'Inscripción abierta'
}

function buildMatchesListItems(
  data: MyMatchesDashboard,
  invitations: MyMatchInvitationRow[]
): MatchesListItem[] {
  const awaitingIds = new Set(data.awaitingResultValidation.map((m) => m.id))
  const inProgressDeduped = data.inProgress.filter((m) => !awaitingIds.has(m.id))
  const tournamentsUpcoming = data.tournamentsUpcoming ?? []
  const tournamentsInProgress = data.tournamentsInProgress ?? []
  const leaguesUpcoming = data.leaguesUpcoming ?? []
  const leaguesInProgress = data.leaguesInProgress ?? []
  const hasAny =
    invitations.length > 0 ||
    data.upcoming.length > 0 ||
    inProgressDeduped.length > 0 ||
    data.awaitingResultValidation.length > 0 ||
    tournamentsUpcoming.length > 0 ||
    tournamentsInProgress.length > 0 ||
    leaguesUpcoming.length > 0 ||
    leaguesInProgress.length > 0

  const items: MatchesListItem[] = []
  if (!hasAny) {
    items.push({ key: 'empty', kind: 'empty' })
    return items
  }

  const pushSection = (title: string, rows: MatchesListItem[]) => {
    if (rows.length === 0) return
    items.push({ key: `section-${title}`, kind: 'section', title })
    items.push(...rows)
  }

  pushSection(
    'Invitaciones',
    invitations.map((inv) => ({
      key: `invitation-${inv.invitation_id}`,
      kind: 'invitation' as const,
      invitation: inv,
    }))
  )

  pushSection(
    'Pendiente: validar resultado',
    data.awaitingResultValidation.map((m) => ({
      key: `match-${m.id}`,
      kind: 'row' as const,
      href: `/(tabs)/matches/${m.id}`,
      accessibilityKind: 'Partida',
      title: m.title,
      location: matchLocation(m),
      startAt: m.start_at,
      tone: 'pending' as const,
      statusLabel: 'Pendiente',
      hint: 'Tienes que aprobar o disputar el marcador enviado por el rival.',
    }))
  )

  const inCourseRows: MatchesListItem[] = [
    ...inProgressDeduped.map((m) => ({
      key: `match-${m.id}`,
      kind: 'row' as const,
      href: `/(tabs)/matches/${m.id}`,
      accessibilityKind: 'Partida',
      title: m.title,
      location: matchLocation(m),
      startAt: m.start_at,
      tone: 'active' as const,
      statusLabel: 'En curso',
    })),
    ...tournamentsInProgress.map((t) => ({
      key: `tournament-${t.id}`,
      kind: 'row' as const,
      href: `/(tabs)/tournaments/${t.id}`,
      accessibilityKind: 'Torneo',
      kindLabel: 'Torneo',
      title: t.title,
      location: matchLocation(t),
      startAt: t.start_at,
      tone: 'active' as const,
      statusLabel: tournamentStatusLabel(t),
      hint: t.isOrganizer ? 'Organizas este torneo' : undefined,
      hintTone: t.isOrganizer ? ('info' as const) : undefined,
    })),
    ...leaguesInProgress.map((l) => ({
      key: `league-${l.id}`,
      kind: 'row' as const,
      href: `/(tabs)/leagues/${l.id}`,
      accessibilityKind: 'Liga',
      kindLabel: `Liga · ${leagueFormatDisplay(l.format)}`,
      title: l.title,
      location: matchLocation(l),
      startAt: l.start_at,
      tone: 'active' as const,
      statusLabel: leagueStatusDisplay(l).text,
      hint: l.isOrganizer ? 'Organizas esta liga' : undefined,
      hintTone: l.isOrganizer ? ('info' as const) : undefined,
    })),
  ].sort((a, b) => {
    if (a.kind !== 'row' || b.kind !== 'row') return 0
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
  pushSection('En curso', inCourseRows)

  const upcomingRows: MatchesListItem[] = [
    ...data.upcoming.map((m) => ({
      key: `match-${m.id}`,
      kind: 'row' as const,
      href: `/(tabs)/matches/${m.id}`,
      accessibilityKind: 'Partida',
      title: m.title,
      location: matchLocation(m),
      startAt: m.start_at,
      tone: 'upcoming' as const,
      statusLabel: 'Próxima',
    })),
    ...tournamentsUpcoming.map((t) => ({
      key: `tournament-${t.id}`,
      kind: 'row' as const,
      href: `/(tabs)/tournaments/${t.id}`,
      accessibilityKind: 'Torneo',
      kindLabel: 'Torneo',
      title: t.title,
      location: matchLocation(t),
      startAt: t.start_at,
      tone: 'upcoming' as const,
      statusLabel: tournamentStatusLabel(t),
      hint: t.isOrganizer ? 'Organizas este torneo' : undefined,
      hintTone: t.isOrganizer ? ('info' as const) : undefined,
    })),
    ...leaguesUpcoming.map((l) => ({
      key: `league-${l.id}`,
      kind: 'row' as const,
      href: `/(tabs)/leagues/${l.id}`,
      accessibilityKind: 'Liga',
      kindLabel: `Liga · ${leagueFormatDisplay(l.format)}`,
      title: l.title,
      location: matchLocation(l),
      startAt: l.start_at,
      tone: 'upcoming' as const,
      statusLabel: leagueStatusDisplay(l).text,
      hint: l.isOrganizer ? 'Organizas esta liga' : undefined,
      hintTone: l.isOrganizer ? ('info' as const) : undefined,
    })),
  ].sort((a, b) => {
    if (a.kind !== 'row' || b.kind !== 'row') return 0
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
  pushSection('Próximas', upcomingRows)

  return items
}

export default function MatchesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)
  const { data, isPending, isError, refetch, isFetched } = useMyMatchesDashboard()
  const { data: invitations } = useMyMatchInvitations()
  const respondInvitation = useRespondMatchInvitation()
  const [isUserRefreshing, setIsUserRefreshing] = useState(false)

  const onUserRefresh = useCallback(async () => {
    setIsUserRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsUserRefreshing(false)
    }
  }, [refetch])

  const createFab = <CreateFab />
  const topPadding = screenTopPadding(insets.top)
  const listItems = useMemo(() => {
    const activeInvites = (invitations ?? []).filter((inv) => inv.status !== MATCH_STATUS.CANCELLED)
    return data ? buildMatchesListItems(data, activeInvites) : []
  }, [data, invitations])

  if (!userId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.empty}>Inicia sesión para ver tus partidas.</Text>
      </View>
    )
  }

  // Only block the screen on the first load — never flash a loader over cached rows.
  if (isPending && !data) {
    return (
      <View style={[styles.centered, { paddingTop: screenTopPadding(insets.top, 24) }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        {createFab}
      </View>
    )
  }

  if ((isError && !data) || (!data && isFetched)) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: screenTopPadding(insets.top, 24), paddingHorizontal: 24 },
        ]}>
        <Text style={styles.empty}>No se pudieron cargar tus partidas.</Text>
        <Pressable onPress={() => refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
        {createFab}
      </View>
    )
  }

  if (!data) {
    return (
      <View style={[styles.centered, { paddingTop: screenTopPadding(insets.top, 24) }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        {createFab}
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: topPadding }]}>
      <FlatList
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.kind === 'empty') {
            return (
              <Text style={styles.emptyBlock}>
                No tienes partidas ni torneos activos aquí. Explora en Descubrir o crea uno nuevo.
              </Text>
            )
          }
          if (item.kind === 'section') {
            return <Text style={styles.sectionTitle}>{item.title}</Text>
          }
          if (item.kind === 'invitation') {
            return (
              <MatchInvitationRow
                invitation={item.invitation}
                loading={respondInvitation.isPending}
                onOpen={() => router.push(`/(tabs)/matches/${item.invitation.match_id}` as Href)}
                onAccept={() =>
                  void respondInvitation
                    .mutateAsync({
                      invitationId: item.invitation.invitation_id,
                      accept: true,
                      matchId: item.invitation.match_id,
                      team: item.invitation.team,
                    })
                    .then(() => router.push(`/(tabs)/matches/${item.invitation.match_id}` as Href))
                    .catch((err) => {
                      Alert.alert(
                        'No se pudo aceptar',
                        err instanceof Error ? err.message : 'Error'
                      )
                    })
                }
                onReject={() =>
                  void respondInvitation
                    .mutateAsync({
                      invitationId: item.invitation.invitation_id,
                      accept: false,
                      matchId: item.invitation.match_id,
                      team: item.invitation.team,
                    })
                    .catch((err) => {
                      Alert.alert(
                        'No se pudo rechazar',
                        err instanceof Error ? err.message : 'Error'
                      )
                    })
                }
              />
            )
          }
          return (
            <MatchListRow
              title={item.title}
              location={item.location}
              startAt={item.startAt}
              tone={item.tone}
              statusLabel={item.statusLabel}
              hint={item.hint}
              hintTone={item.hintTone}
              kindLabel={item.kindLabel}
              accessibilityKind={item.accessibilityKind}
              onPress={() => router.push(item.href as Href)}
            />
          )
        }}
        ListHeaderComponent={<ScreenHeader title="Mis partidas" />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 88 }]}
        refreshControl={
          <RefreshControl
            refreshing={isUserRefreshing}
            onRefresh={() => void onUserRefresh()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
      {createFab}
    </View>
  )
}

function MatchInvitationRow({
  invitation,
  loading,
  onOpen,
  onAccept,
  onReject,
}: {
  invitation: MyMatchInvitationRow
  loading: boolean
  onOpen: () => void
  onAccept: () => void
  onReject: () => void
}) {
  const teamLabel = invitation.team === 'A' ? 'equipo A' : 'equipo rival'
  return (
    <View style={styles.invitationRow}>
      <Pressable
        style={styles.invitationBody}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Invitación a ${invitation.title}`}>
        <StatusDot tone="pending" />
        <View style={styles.rowBody}>
          <Text style={styles.rowKind}>Invitación · {teamLabel}</Text>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {invitation.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {invitation.inviter_name} te ha invitado
          </Text>
        </View>
      </Pressable>
      <View style={styles.invitationActions}>
        <Button
          title="Aceptar"
          onPress={onAccept}
          loading={loading}
          style={styles.smallBtn}
          textStyle={styles.smallBtnText}
        />
        <Button
          title="Rechazar"
          variant="outline"
          onPress={onReject}
          disabled={loading}
          style={styles.smallBtn}
          textStyle={styles.smallBtnText}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: 20 },
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
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
  rowKind: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
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
  rowHintInfo: {
    color: Colors.textSecondary,
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
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  invitationBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  invitationActions: { flexDirection: 'row', gap: 8 },
  smallBtn: { minHeight: 36, paddingHorizontal: 12 },
  smallBtnText: { fontSize: 13 },
})
