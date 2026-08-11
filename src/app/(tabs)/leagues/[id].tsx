import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  AddLeaguePairModal,
  type AddLeaguePairFormValues,
} from '@/components/leagues/AddLeaguePairModal'
import { CancelLeagueModal } from '@/components/leagues/CancelLeagueModal'
import { ChallengeList } from '@/components/leagues/ChallengeList'
import { ChallengeModal } from '@/components/leagues/ChallengeModal'
import { EditLeaguePairModal } from '@/components/leagues/EditLeaguePairModal'
import { EloRanking } from '@/components/leagues/EloRanking'
import { LeaguePairCard } from '@/components/leagues/LeaguePairCard'
import { StandingsTable } from '@/components/leagues/StandingsTable'
import { AddPairButton } from '@/components/ui/AddPairButton'
import { Button } from '@/components/ui/Button'
import { ShareInviteButton } from '@/components/ShareInviteButton'
import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { MatchPasswordModal } from '@/components/matches/MatchPasswordModal'
import { LEAGUE_STATUS, MATCH_VISIBILITY } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import {
  useAcceptLeagueChallenge,
  useAddLeaguePair,
  useCancelLeague,
  useCreateLeagueChallenge,
  useGrantLeaguePasswordAccess,
  useJoinLeaguePair,
  useLeague,
  useLeagueChallenges,
  useLeagueMatches,
  useLeagueStandings,
  useRejectLeagueChallenge,
  useRemoveLeaguePair,
  useStartLeague,
  useUpdateLeaguePair,
} from '@/hooks/useLeagues'
import {
  canEditLeaguePair,
  canJoinLeaguePair,
  findUserLeaguePairId,
  isLeaguePairComplete,
  userIsInLeaguePair,
  type LeagueMatchRow,
  type LeaguePairRow,
} from '@/services/leagues.service'
import { confirmAlert, showAlert } from '@/utils/alert'
import {
  isOpenEloFormat,
  isRoundRobinFormat,
  leagueFormatDisplay,
  leagueStatusDisplay,
} from '@/utils/leagueDisplay'
import { formatCityAndPlace } from '@/utils/location'
import { matchStatusDisplay } from '@/utils/matchDisplay'

import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

type TabKey = 'standings' | 'matches' | 'pairs'

function LeagueMatchCard({ match, onPress }: { match: LeagueMatchRow; onPress: () => void }) {
  const status = matchStatusDisplay({ status: match.status })
  const score =
    match.team_a_games != null && match.team_b_games != null
      ? `${match.team_a_games} - ${match.team_b_games}`
      : null
  return (
    <Pressable style={s.matchCard} onPress={onPress} accessibilityRole="button">
      <View style={s.matchCardHeader}>
        <Text style={s.matchCardTitle}>
          {match.pair_a_name ?? 'Pareja A'} vs {match.pair_b_name ?? 'Pareja B'}
        </Text>
        <View style={[s.matchStatusBadge, { borderColor: status.color }]}>
          <Text style={[s.matchStatusText, { color: status.color }]}>{status.text}</Text>
        </View>
      </View>
      <Text style={s.matchCardMeta}>
        {match.round_number != null ? `Jornada ${match.round_number} · ` : ''}
        {formatDisplay(match.start_at)}
        {score ? ` · ${score}` : ''}
      </Text>
    </Pressable>
  )
}

type RoundGroup = {
  key: string
  label: string
  order: number
  matches: LeagueMatchRow[]
}

function groupMatchesByRound(matches: LeagueMatchRow[]): RoundGroup[] {
  const byKey = new Map<string, RoundGroup>()
  for (const m of matches) {
    const hasRound = m.round_number != null
    const key = hasRound ? `round-${m.round_number}${m.is_second_leg ? '-vuelta' : ''}` : 'no-round'
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: hasRound
          ? `Jornada ${m.round_number}${m.is_second_leg ? ' (vuelta)' : ''}`
          : 'Partidos',
        order: hasRound ? m.round_number! * 10 + (m.is_second_leg ? 1 : 0) : 9999,
        matches: [],
      })
    }
    byKey.get(key)!.matches.push(m)
  }
  return Array.from(byKey.values()).sort((a, b) => a.order - b.order)
}

function MatchesByRound({
  matches,
  inRegistration,
  onMatchPress,
}: {
  matches: LeagueMatchRow[]
  inRegistration: boolean
  onMatchPress: (matchId: string) => void
}) {
  if (matches.length === 0) {
    return (
      <Text style={s.empty}>
        {inRegistration ? 'Los partidos aparecerán al iniciar la liga' : 'Aún no hay partidos'}
      </Text>
    )
  }
  const groups = groupMatchesByRound(matches)
  return (
    <View>
      {groups.map((g) => (
        <View key={g.key} style={s.roundGroup}>
          <Text style={s.roundLabel}>{g.label}</Text>
          {g.matches.map((m) => (
            <LeagueMatchCard key={m.match_id} match={m} onPress={() => onMatchPress(m.match_id)} />
          ))}
        </View>
      ))}
    </View>
  )
}

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)

  const closeLeagueDetail = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/matches' as Href)
  }, [router])

  const {
    data: league,
    isLoading,
    isError,
    refetch: refetchLeague,
    isRefetching: isRefetchingLeague,
  } = useLeague(id)

  const [tab, setTab] = useState<TabKey>('pairs')
  const [pairModalOpen, setPairModalOpen] = useState(false)
  const [editingPair, setEditingPair] = useState<LeaguePairRow | null>(null)
  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [passwordModalDismissed, setPasswordModalDismissed] = useState(false)
  const [cancelVisible, setCancelVisible] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [challengeActionId, setChallengeActionId] = useState<string | null>(null)

  const needsPassword = Boolean(
    league &&
    league.visibility === MATCH_VISIBILITY.PRIVATE &&
    league.viewer_has_full_access === false
  )
  const passwordModalVisible = needsPassword && !passwordModalDismissed
  const fullAccess = !needsPassword

  const standingsQ = useLeagueStandings(id, fullAccess)
  const matchesQ = useLeagueMatches(id, fullAccess)
  const challengesQ = useLeagueChallenges(
    id,
    fullAccess && Boolean(league && isOpenEloFormat(league.format))
  )

  const grantAccess = useGrantLeaguePasswordAccess()
  const addPair = useAddLeaguePair()
  const joinPair = useJoinLeaguePair()
  const updatePair = useUpdateLeaguePair()
  const removePair = useRemoveLeaguePair()
  const startLeague = useStartLeague()
  const cancelLeague = useCancelLeague()
  const createChallenge = useCreateLeagueChallenge()
  const acceptChallenge = useAcceptLeagueChallenge()
  const rejectChallenge = useRejectLeagueChallenge()

  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now())
      void refetchLeague()
      if (fullAccess) {
        void standingsQ.refetch()
        void matchesQ.refetch()
        void challengesQ.refetch()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on focus only
    }, [fullAccess, id, refetchLeague])
  )

  if (isLoading && !league) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top) }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (isError || !league) {
    return (
      <View style={[s.centered, { paddingTop: screenTopPadding(insets.top) }]}>
        <Text style={s.error}>No se pudo cargar la liga</Text>
        <Button title="Volver" onPress={closeLeagueDetail} />
      </View>
    )
  }

  const status = leagueStatusDisplay(league)
  const isCreator = userId === league.creator_id
  const inRegistration = league.status === LEAGUE_STATUS.REGISTRATION
  const inProgress = league.status === LEAGUE_STATUS.IN_PROGRESS
  const acceptingPairs = inRegistration || inProgress
  const userPairId = userId ? findUserLeaguePairId(league.pairs, userId) : null
  const completePairs = league.pairs.filter(isLeaguePairComplete)
  const canStart = isCreator && inRegistration && completePairs.length >= 2
  const openEnded =
    isOpenEloFormat(league.format) && league.end_at && new Date(league.end_at).getTime() > nowMs

  const refreshAll = async () => {
    await refetchLeague()
    if (fullAccess) {
      await Promise.all([
        standingsQ.refetch(),
        matchesQ.refetch(),
        isOpenEloFormat(league.format) ? challengesQ.refetch() : Promise.resolve(),
      ])
    }
  }

  const handleAddPair = async (values: AddLeaguePairFormValues) => {
    if (!userId) return
    const already = userIsInLeaguePair(league.pairs, userId)
    const useSelfA = values.playerAIsSelf && !already
    const useSelfB = values.playerBIsSelf && !already && !useSelfA
    try {
      await addPair.mutateAsync({
        leagueId: id,
        name: values.name.trim() || undefined,
        playerAUserId: useSelfA ? userId : null,
        playerAText: useSelfA ? null : values.playerAText.trim() || null,
        playerBUserId: useSelfB ? userId : null,
        playerBText: useSelfB ? null : values.playerBText.trim() || null,
      })
      setPairModalOpen(false)
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo añadir')
      throw err
    }
  }

  const handleStart = async () => {
    const ok = await confirmAlert(
      'Iniciar liga',
      isRoundRobinFormat(league.format)
        ? 'Se generarán todos los enfrentamientos. Podrás seguir añadiendo parejas (jugarán catch-up). ¿Continuar?'
        : 'La liga abierta empezará y las parejas podrán desafiarse hasta la fecha de fin. ¿Continuar?'
    )
    if (!ok) return
    try {
      await startLeague.mutateAsync({ leagueId: id, format: league.format })
      setTab('standings')
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo iniciar')
    }
  }

  const challengeOpponents = completePairs.filter((p) => p.id !== userPairId)

  return (
    <View style={[s.root, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={s.topBar}>
        <Pressable
          onPress={closeLeagueDetail}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
          <Text style={s.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingLeague || standingsQ.isRefetching || matchesQ.isRefetching}
            onRefresh={() => void refreshAll()}
          />
        }>
        <Text style={s.title}>{league.title}</Text>
        <View style={s.badgeRow}>
          <View style={[s.badge, { borderColor: status.color }]}>
            <Text style={[s.badgeText, { color: status.color }]}>{status.text}</Text>
          </View>
          <Text style={s.format}>{leagueFormatDisplay(league.format)}</Text>
        </View>
        <Text style={s.meta}>
          {formatCityAndPlace(league.city, league.place_defined, league.place_text)}
        </Text>
        <Text style={s.meta}>Inicio: {formatDisplay(league.start_at)}</Text>
        {isOpenEloFormat(league.format) && league.end_at ? (
          <Text style={s.meta}>Fin: {formatDisplay(league.end_at)}</Text>
        ) : null}
        {league.organizer_display_name ? (
          <Text style={s.meta}>Organiza: {league.organizer_display_name}</Text>
        ) : null}
        {league.description ? <Text style={s.desc}>{league.description}</Text> : null}

        {!needsPassword ? (
          <ShareInviteButton
            kind="league"
            id={id}
            title={league.title}
            meta={`${formatCityAndPlace(league.city, league.place_defined, league.place_text)} · ${formatDisplay(league.start_at)}`}
            style={s.shareBtn}
          />
        ) : null}

        {fullAccess ? (
          <>
            <View style={s.tabs}>
              {(
                [
                  ['pairs', 'Parejas'],
                  ['standings', isOpenEloFormat(league.format) ? 'Elo' : 'Clasificación'],
                  ['matches', 'Partidos'],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[s.tab, tab === key && s.tabActive]}
                  onPress={() => setTab(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === key }}>
                  <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'pairs' ? (
              <View>
                {league.pairs.map((pair) => {
                  const join = canJoinLeaguePair(pair, userId, league.pairs, league.status)
                  const canEdit = canEditLeaguePair(pair, userId, isCreator, league.status)
                  const canChallenge =
                    inProgress &&
                    isOpenEloFormat(league.format) &&
                    Boolean(userPairId) &&
                    pair.id !== userPairId &&
                    isLeaguePairComplete(pair) &&
                    openEnded
                  return (
                    <LeaguePairCard
                      key={pair.id}
                      pair={pair}
                      eloLabel={
                        isOpenEloFormat(league.format) ? `Elo ${pair.current_elo}` : undefined
                      }
                      subtitle={isLeaguePairComplete(pair) ? undefined : 'Incompleta'}
                      onEdit={canEdit ? () => setEditingPair(pair) : undefined}
                      joinLabel={join.canJoin ? 'Unirme' : undefined}
                      onJoin={
                        join.canJoin && join.openSlot
                          ? () =>
                              void joinPair
                                .mutateAsync({
                                  pairId: pair.id,
                                  slot: join.openSlot!,
                                  leagueId: id,
                                })
                                .catch((err) =>
                                  showAlert(
                                    'Error',
                                    err instanceof Error ? err.message : 'No se pudo unir'
                                  )
                                )
                          : undefined
                      }
                      joinLoading={joinPair.isPending}
                      challengeLabel={canChallenge ? 'Desafiar' : undefined}
                      onChallenge={
                        canChallenge
                          ? () => {
                              setChallengeModalOpen(true)
                            }
                          : undefined
                      }
                    />
                  )
                })}
                {acceptingPairs ? (
                  <AddPairButton
                    hasPairs={league.pairs.length > 0}
                    onPress={() => setPairModalOpen(true)}
                  />
                ) : null}
                {inProgress && isOpenEloFormat(league.format) && userPairId && openEnded ? (
                  <Button
                    title="Desafiar pareja"
                    onPress={() => setChallengeModalOpen(true)}
                    style={{ marginTop: 8 }}
                  />
                ) : null}
                {inProgress && isOpenEloFormat(league.format) ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={s.sectionTitle}>Desafíos</Text>
                    <ChallengeList
                      challenges={challengesQ.data ?? []}
                      userPairId={userPairId}
                      isOrganizer={isCreator}
                      actionLoadingId={challengeActionId}
                      onAccept={(challengeId) => {
                        setChallengeActionId(challengeId)
                        void acceptChallenge
                          .mutateAsync({ challengeId, leagueId: id })
                          .then((ch) => {
                            if (ch.match_id) {
                              router.push(`/(tabs)/matches/${ch.match_id}` as Href)
                            }
                          })
                          .catch((err) =>
                            showAlert(
                              'Error',
                              err instanceof Error ? err.message : 'No se pudo aceptar'
                            )
                          )
                          .finally(() => setChallengeActionId(null))
                      }}
                      onReject={(challengeId) => {
                        setChallengeActionId(challengeId)
                        void rejectChallenge
                          .mutateAsync({ challengeId, leagueId: id })
                          .catch((err) =>
                            showAlert(
                              'Error',
                              err instanceof Error ? err.message : 'No se pudo rechazar'
                            )
                          )
                          .finally(() => setChallengeActionId(null))
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {tab === 'standings' ? (
              <View>
                {isOpenEloFormat(league.format) ? (
                  <EloRanking rows={standingsQ.data ?? []} />
                ) : (
                  <StandingsTable rows={standingsQ.data ?? []} />
                )}
              </View>
            ) : null}

            {tab === 'matches' ? (
              <MatchesByRound
                matches={matchesQ.data ?? []}
                inRegistration={inRegistration}
                onMatchPress={(matchId) => router.push(`/(tabs)/matches/${matchId}` as Href)}
              />
            ) : null}

            {canStart ? (
              <Button
                title="Iniciar liga"
                onPress={() => void handleStart()}
                loading={startLeague.isPending}
                style={{ marginTop: 16 }}
              />
            ) : null}

            {isCreator && inRegistration ? (
              <Button
                title="Editar liga"
                variant="secondary"
                onPress={() => router.push(`/(tabs)/leagues/edit/${id}` as Href)}
                style={{ marginTop: 8 }}
              />
            ) : null}

            {isCreator && (inRegistration || inProgress) ? (
              <Button
                title="Cancelar liga"
                variant="danger"
                onPress={() => setCancelVisible(true)}
                style={{ marginTop: 8 }}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <MatchPasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalDismissed(true)}
        isLoading={grantAccess.isPending}
        accessOnly
        title="Liga privada"
        hint="Introduce la contraseña para ver la liga"
        onSubmit={async (password) => {
          await grantAccess.mutateAsync({ leagueId: id, password })
        }}
      />

      <AddLeaguePairModal
        visible={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSubmit={handleAddPair}
        loading={addPair.isPending}
        defaultSelfSlot={userId && userIsInLeaguePair(league.pairs, userId) ? null : 'a'}
        selfJoinDisabled={Boolean(userId && userIsInLeaguePair(league.pairs, userId))}
      />

      <EditLeaguePairModal
        visible={Boolean(editingPair)}
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        saveLoading={updatePair.isPending}
        deleteLoading={removePair.isPending}
        canDelete={isCreator && inRegistration && !league.fixtures_generated_at}
        onSubmit={async (values) => {
          if (!editingPair) return
          try {
            await updatePair.mutateAsync({
              pairId: editingPair.id,
              leagueId: id,
              name: values.name.trim() || undefined,
              playerAText: editingPair.player_a_user_id ? null : values.playerAText.trim() || null,
              playerBText: editingPair.player_b_user_id ? null : values.playerBText.trim() || null,
            })
            setEditingPair(null)
          } catch (err) {
            showAlert('Error', err instanceof Error ? err.message : 'No se pudo guardar')
            throw err
          }
        }}
        onDelete={async () => {
          if (!editingPair) return
          try {
            await removePair.mutateAsync({ pairId: editingPair.id, leagueId: id })
            setEditingPair(null)
          } catch (err) {
            showAlert('Error', err instanceof Error ? err.message : 'No se pudo eliminar')
          }
        }}
      />

      <ChallengeModal
        visible={challengeModalOpen}
        onClose={() => setChallengeModalOpen(false)}
        opponents={challengeOpponents}
        loading={createChallenge.isPending}
        onChallenge={async (pairId) => {
          await createChallenge.mutateAsync({ leagueId: id, challengedPairId: pairId })
        }}
      />

      <CancelLeagueModal
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        hasFixturesOrInProgress={Boolean(league.fixtures_generated_at) || inProgress}
        loading={cancelLeague.isPending}
        onConfirm={async () => {
          await cancelLeague.mutateAsync(id)
          router.replace('/(tabs)/matches' as Href)
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  close: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  container: { padding: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  error: { color: Colors.danger, marginBottom: 12 },
  title: { fontSize: 24, fontFamily: Fonts.bold, color: Colors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontFamily: Fonts.semiBold },
  format: { fontSize: 13, color: Colors.textSecondary },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  desc: { fontSize: 14, color: Colors.textPrimary, marginTop: 10, lineHeight: 20 },
  shareBtn: { marginTop: 12 },
  tabs: { flexDirection: 'row', marginTop: 16, marginBottom: 12, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  tabText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  roundGroup: { marginTop: 12 },
  roundLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: { color: Colors.textSecondary, fontStyle: 'italic', paddingVertical: 12 },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
  },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  matchCardTitle: { flex: 1, fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  matchStatusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  matchStatusText: { fontSize: 11, fontFamily: Fonts.semiBold },
  matchCardMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
})
