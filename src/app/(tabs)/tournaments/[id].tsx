import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AddPairModal, type AddPairFormValues } from '@/components/tournaments/AddPairModal'
import { BracketCanvas } from '@/components/tournaments/BracketCanvas'
import { EditPairModal, type EditPairFormValues } from '@/components/tournaments/EditPairModal'
import { PairCard } from '@/components/tournaments/PairCard'
import { Button } from '@/components/ui/Button'
import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { MATCH_STATUS, TOURNAMENT_STATUS } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { confirmAlert, showAlert } from '@/utils/alert'
import { formatCityAndPlace } from '@/utils/location'
import {
  useAddTournamentPair,
  useGenerateTournamentBracket,
  useJoinTournamentPair,
  useRemoveTournamentPair,
  useUpdateTournamentPair,
  useTournament,
  useTournamentBracket,
} from '@/hooks/useTournaments'
import type { TournamentPairRow } from '@/services/tournaments.service'
import {
  canJoinTournamentPair,
  isTournamentPairComplete,
  userIsInTournamentPair,
  type BracketNodeRow,
} from '@/services/tournaments.service'
import { isPlaceholderNode } from '@/utils/bracketLayout'
import { matchStatusDisplay } from '@/utils/matchDisplay'
import { tournamentStatusDisplay } from '@/utils/tournamentDisplay'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'

type TabKey = 'bracket' | 'matches'

function TournamentMatchCard({ node, onPress }: { node: BracketNodeRow; onPress: () => void }) {
  const matchStatus = matchStatusDisplay({ status: node.match_status })
  return (
    <Pressable style={s.matchCard} onPress={onPress} accessibilityRole="button">
      <View style={s.matchCardHeader}>
        <Text style={s.matchCardTitle}>
          {node.pair_a_name} vs {node.pair_b_name}
        </Text>
        <View style={[s.matchStatusBadge, { borderColor: matchStatus.color }]}>
          <Text style={[s.matchStatusText, { color: matchStatus.color }]}>{matchStatus.text}</Text>
        </View>
      </View>
      <Text style={s.matchCardMeta}>{formatDisplay(node.start_at)}</Text>
    </Pressable>
  )
}

function isBracketPlayableNode(node: BracketNodeRow): boolean {
  return !node.is_bye && !isPlaceholderNode(node) && Boolean(node.pair_a_id && node.pair_b_id)
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.session?.user.id)

  const {
    data: tournament,
    isLoading,
    isError,
    refetch: refetchTournament,
    isRefetching: isRefetchingTournament,
  } = useTournament(id)
  const {
    data: bracket,
    refetch: refetchBracket,
    isRefetching: isRefetchingBracket,
  } = useTournamentBracket(id)
  const generateBracket = useGenerateTournamentBracket()
  const addPair = useAddTournamentPair()
  const joinPair = useJoinTournamentPair()
  const updatePair = useUpdateTournamentPair()
  const removePair = useRemoveTournamentPair()

  const [tab, setTab] = useState<TabKey>('bracket')
  const [pairModalOpen, setPairModalOpen] = useState(false)
  const [editingPair, setEditingPair] = useState<TournamentPairRow | null>(null)

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchTournament(), refetchBracket()])
  }, [refetchTournament, refetchBracket])

  useFocusEffect(
    useCallback(() => {
      void refetchAll()
    }, [refetchAll])
  )

  const isRefreshing = isRefetchingTournament || isRefetchingBracket

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (isError || !tournament) {
    return (
      <View style={s.centered}>
        <Text style={s.error}>No se pudo cargar el torneo.</Text>
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const isCreator = tournament.creator_id === userId
  const inRegistration = tournament.status === TOURNAMENT_STATUS.REGISTRATION
  const canManagePairs = isCreator && inRegistration && !tournament.bracket_generated_at
  const bracketGenerated =
    Boolean(tournament.bracket_generated_at) || tournament.status !== TOURNAMENT_STATUS.REGISTRATION
  const nodes = bracket?.nodes ?? []
  const playableMatches = nodes.filter(isBracketPlayableNode)
  const pendingMatches = playableMatches.filter(
    (n) => n.match_status === MATCH_STATUS.IN_PROGRESS || n.match_status === MATCH_STATUS.PLANNED
  )
  const finishedMatches = playableMatches.filter(
    (n) => n.match_status !== MATCH_STATUS.IN_PROGRESS && n.match_status !== MATCH_STATUS.PLANNED
  )
  const status = tournamentStatusDisplay(tournament)
  const completePairs = tournament.pairs.filter(isTournamentPairComplete)

  const handleGenerate = async () => {
    if (completePairs.length < 2) {
      Alert.alert(
        'Parejas insuficientes',
        'Se necesitan al menos 2 parejas completas (con dos jugadores) para organizar el cuadro.'
      )
      return
    }
    const skipped = tournament.pairs.length - completePairs.length
    if (skipped > 0) {
      Alert.alert(
        'Parejas incompletas',
        `${skipped} pareja(s) sin los dos jugadores no entrarán en el cuadro. ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Organizar', onPress: () => void runGenerateBracket() },
        ]
      )
      return
    }
    await runGenerateBracket()
  }

  const runGenerateBracket = async () => {
    try {
      await generateBracket.mutateAsync(id)
      setTab('bracket')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo generar el cuadro')
    }
  }

  const handleAddPair = async (values: AddPairFormValues) => {
    if (!userId) return
    try {
      await addPair.mutateAsync({
        tournamentId: id,
        name: values.name.trim() || undefined,
        playerAUserId: values.playerAIsSelf ? userId : null,
        playerAText: values.playerAIsSelf ? null : values.playerAText.trim() || null,
        playerBUserId: values.playerBIsSelf ? userId : null,
        playerBText: values.playerBIsSelf ? null : values.playerBText.trim() || null,
      })
      setPairModalOpen(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo añadir la pareja')
      // Propagamos el error para evitar que el modal reinicie el formulario.
      throw err
    }
  }

  const handleJoinPair = async (pairId: string, slot: 'a' | 'b') => {
    try {
      await joinPair.mutateAsync({ pairId, slot, tournamentId: id })
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo unir a la pareja')
    }
  }

  const handleEditPair = async (values: EditPairFormValues) => {
    if (!editingPair) return
    try {
      await updatePair.mutateAsync({
        pairId: editingPair.id,
        tournamentId: id,
        name: values.name.trim() || undefined,
        playerAText: editingPair.player_a_user_id ? null : values.playerAText.trim() || null,
        playerBText: editingPair.player_b_user_id ? null : values.playerBText.trim() || null,
      })
      setEditingPair(null)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la pareja')
      throw err
    }
  }

  const confirmDeletePair = async () => {
    if (!editingPair) return
    const pairId = editingPair.id
    const ok = await confirmAlert(
      'Eliminar pareja',
      '¿Seguro que quieres eliminar esta pareja del torneo?',
      { confirmText: 'Eliminar', destructive: true }
    )
    if (ok) void runDeletePair(pairId)
  }

  const runDeletePair = async (pairId: string) => {
    try {
      await removePair.mutateAsync({ pairId, tournamentId: id })
      setEditingPair(null)
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo eliminar la pareja')
    }
  }

  return (
    <View style={[s.root, { paddingTop: screenTopPadding(insets.top, 8) }]}>
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
          <Text style={s.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetchAll()}
            tintColor={Colors.primary}
          />
        }>
        <View style={s.headerBlock}>
          <Text style={s.title}>{tournament.title}</Text>
          <View style={[s.statusBadge, { borderColor: status.color }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>
        <View style={s.infoBlock}>
          <Text style={s.meta}>{formatDisplay(tournament.start_at)}</Text>
          <Text style={s.meta}>
            {formatCityAndPlace(tournament.city, tournament.place_defined, tournament.place_text)}
          </Text>
          {tournament.organizer_display_name ? (
            <Text style={s.organizer}>Organizado por {tournament.organizer_display_name}</Text>
          ) : null}
        </View>
        {tournament.description ? <Text style={s.desc}>{tournament.description}</Text> : null}

        <View style={s.tabs}>
          <Pressable
            style={[s.tab, tab === 'bracket' && s.tabOn]}
            onPress={() => setTab('bracket')}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'bracket' }}>
            <Text style={[s.tabText, tab === 'bracket' && s.tabTextOn]}>Cuadro</Text>
          </Pressable>
          <Pressable
            style={[s.tab, tab === 'matches' && s.tabOn]}
            onPress={() => setTab('matches')}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'matches' }}>
            <Text style={[s.tabText, tab === 'matches' && s.tabTextOn]}>Partidos</Text>
          </Pressable>
        </View>

        {tab === 'bracket' ? (
          <View style={s.bracketSection}>
            <BracketCanvas nodes={nodes} bracketGenerated={bracketGenerated} />
          </View>
        ) : (
          <View style={s.matchesWrap}>
            <Text style={s.matchesSectionTitle}>Pendientes</Text>
            {pendingMatches.length === 0 ? (
              <Text style={s.empty}>No hay partidos pendientes.</Text>
            ) : (
              pendingMatches.map((m) => (
                <TournamentMatchCard
                  key={m.match_id}
                  node={m}
                  onPress={() => router.push(`/(tabs)/matches/${m.match_id}`)}
                />
              ))
            )}
            <Text style={[s.matchesSectionTitle, s.matchesSectionTitleSpaced]}>Terminados</Text>
            {finishedMatches.length === 0 ? (
              <Text style={s.empty}>No hay partidos terminados.</Text>
            ) : (
              finishedMatches.map((m) => (
                <TournamentMatchCard
                  key={m.match_id}
                  node={m}
                  onPress={() => router.push(`/(tabs)/matches/${m.match_id}`)}
                />
              ))
            )}
          </View>
        )}

        {tournament.pairs.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Parejas ({tournament.pairs.length})</Text>
            {tournament.pairs.map((p) => {
              const { canJoin, openSlot } = canJoinTournamentPair(
                p,
                userId,
                tournament.pairs,
                inRegistration
              )
              return (
                <PairCard
                  key={p.id}
                  pair={p}
                  subtitle={
                    inRegistration && !isTournamentPairComplete(p) ? 'Falta un jugador' : undefined
                  }
                  editLabel={canManagePairs ? 'Editar' : undefined}
                  onEdit={canManagePairs ? () => setEditingPair(p) : undefined}
                  joinLabel={canJoin ? 'Unirme' : undefined}
                  onJoin={canJoin ? () => void handleJoinPair(p.id, openSlot!) : undefined}
                  joinLoading={joinPair.isPending}
                />
              )
            })}
          </View>
        ) : null}

        <View style={s.actions}>
          {inRegistration ? (
            <>
              <Button
                title="Añadir pareja"
                variant="outline"
                onPress={() => setPairModalOpen(true)}
              />
              {isCreator ? (
                <Button
                  title="Organizar cuadro"
                  onPress={() => void handleGenerate()}
                  loading={generateBracket.isPending}
                  style={s.actionGap}
                />
              ) : null}
            </>
          ) : null}
          {isCreator && inRegistration ? (
            <Button
              title="Editar torneo"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/tournaments/edit/${id}` as Href)}
              style={s.actionGap}
            />
          ) : null}
        </View>
      </ScrollView>

      <AddPairModal
        visible={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSubmit={handleAddPair}
        loading={addPair.isPending}
        selfJoinDisabled={Boolean(userId && userIsInTournamentPair(tournament.pairs, userId))}
      />

      <EditPairModal
        visible={editingPair !== null}
        pair={editingPair}
        onClose={() => setEditingPair(null)}
        onSubmit={handleEditPair}
        onDelete={confirmDeletePair}
        saveLoading={updatePair.isPending}
        deleteLoading={removePair.isPending}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  close: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 16, color: Colors.textSecondary },
  headerBlock: { gap: 8, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontFamily: Fonts.semiBold },
  infoBlock: { marginTop: 4, marginBottom: 12 },
  meta: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  organizer: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
  desc: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabOn: { borderColor: Colors.primary, backgroundColor: Colors.wonBackground },
  tabText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  tabTextOn: { color: Colors.primary },
  bracketSection: { minHeight: 300, marginBottom: 8 },
  matchesWrap: { minHeight: 120 },
  matchesSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  matchesSectionTitleSpaced: { marginTop: 16 },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  matchCardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  matchStatusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchStatusText: { fontSize: 11, fontFamily: Fonts.semiBold },
  matchCardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  empty: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic', padding: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.primary, marginBottom: 10 },
  actions: { marginTop: 20, gap: 10 },
  actionGap: { marginTop: 0 },
})
