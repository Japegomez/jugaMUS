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
import { PairCard } from '@/components/tournaments/PairCard'
import { Button } from '@/components/ui/Button'
import { formatDisplay } from '@/components/ui/dateTimePickerUtils'
import { MATCH_STATUS, TOURNAMENT_STATUS } from '@/constants'
import { useAuthStore } from '@/hooks/useAuth'
import { formatCityAndPlace } from '@/utils/location'
import {
  useAddTournamentPair,
  useGenerateTournamentBracket,
  useJoinTournamentPair,
  useTournament,
  useTournamentBracket,
} from '@/hooks/useTournaments'
import { canJoinTournamentPair, userIsInTournamentPair } from '@/services/tournaments.service'
import { isPlaceholderNode } from '@/utils/bracketLayout'

type TabKey = 'bracket' | 'pending'

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

  const [tab, setTab] = useState<TabKey>('bracket')
  const [pairModalOpen, setPairModalOpen] = useState(false)

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
        <ActivityIndicator size="large" color="#1a5f4a" />
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
  const bracketGenerated =
    Boolean(tournament.bracket_generated_at) || tournament.status !== TOURNAMENT_STATUS.REGISTRATION
  const nodes = bracket?.nodes ?? []
  const pendingMatches = nodes.filter(
    (n) =>
      !n.is_bye &&
      !isPlaceholderNode(n) &&
      (n.match_status === MATCH_STATUS.IN_PROGRESS || n.match_status === MATCH_STATUS.PLANNED) &&
      Boolean(n.pair_a_id && n.pair_b_id)
  )

  const handleGenerate = async () => {
    if (tournament.pairs.length < 2) {
      Alert.alert(
        'Parejas insuficientes',
        'Se necesitan al menos 2 parejas para organizar el cuadro.'
      )
      return
    }
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
        name: values.name.trim(),
        playerAUserId: values.playerAIsSelf ? userId : null,
        playerAText: values.playerAIsSelf ? null : values.playerAText.trim() || null,
        playerBUserId: values.playerBIsSelf ? userId : null,
        playerBText: values.playerBIsSelf ? null : values.playerBText.trim() || null,
      })
      setPairModalOpen(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo añadir la pareja')
    }
  }

  const handleJoinPair = async (pairId: string, slot: 'a' | 'b') => {
    try {
      await joinPair.mutateAsync({ pairId, slot, tournamentId: id })
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo unir a la pareja')
    }
  }

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 8) }]}>
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
            tintColor="#1a5f4a"
          />
        }>
        <Text style={s.title}>{tournament.title}</Text>
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
            style={[s.tab, tab === 'pending' && s.tabOn]}
            onPress={() => setTab('pending')}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'pending' }}>
            <Text style={[s.tabText, tab === 'pending' && s.tabTextOn]}>Partidos pendientes</Text>
          </Pressable>
        </View>

        {tab === 'bracket' ? (
          <View style={s.bracketSection}>
            <BracketCanvas nodes={nodes} bracketGenerated={bracketGenerated} />
          </View>
        ) : (
          <View style={s.pendingWrap}>
            {pendingMatches.length === 0 ? (
              <Text style={s.empty}>No hay partidos pendientes.</Text>
            ) : (
              pendingMatches.map((m) => (
                <Pressable
                  key={m.match_id}
                  style={s.pendingCard}
                  onPress={() => router.push(`/(tabs)/matches/${m.match_id}`)}
                  accessibilityRole="button">
                  <Text style={s.pendingTitle}>
                    {m.pair_a_name} vs {m.pair_b_name}
                  </Text>
                  <Text style={s.pendingMeta}>{formatDisplay(m.start_at)}</Text>
                </Pressable>
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
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f4' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  close: { fontSize: 22, color: '#555', padding: 8 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 16, color: '#888' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  infoBlock: { marginTop: 4, marginBottom: 12 },
  meta: { fontSize: 14, color: '#666', marginTop: 2 },
  organizer: { fontSize: 14, color: '#555', marginTop: 6 },
  desc: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  tabOn: { borderColor: '#1a5f4a', backgroundColor: '#eef7f3' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextOn: { color: '#1a5f4a' },
  bracketSection: { minHeight: 300, marginBottom: 8 },
  pendingWrap: { minHeight: 120 },
  pendingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  pendingTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  pendingMeta: { fontSize: 13, color: '#666', marginTop: 4 },
  empty: { fontSize: 14, color: '#999', fontStyle: 'italic', padding: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a5f4a', marginBottom: 10 },
  actions: { marginTop: 20, gap: 10 },
  actionGap: { marginTop: 0 },
})
