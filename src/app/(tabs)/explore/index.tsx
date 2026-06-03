import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { CreateFab } from '@/components/ui/CreateFab'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { StatusDot, type StatusDotTone } from '@/components/ui/StatusDot'
import {
  dateToEndOfLocalDayIso,
  dateToLocalIsoString,
  dateToStartOfLocalDayIso,
  formatDisplay,
  parseIsoToDate,
} from '@/components/ui/dateTimePickerUtils'
import { MunicipalityPicker } from '@/components/ui/MunicipalityPicker'
import { MATCH_STATUS, TOURNAMENT_STATUS, type ExploreContentType } from '@/constants'
import { useInfinitePublicMatches, usePublicTournamentsExplore } from '@/hooks/useMatches'
import type { PublicMatchExplorerRow, PublicMatchesListFilters } from '@/services/matches.service'
import type { PublicTournamentsListFilters, TournamentRow } from '@/services/tournaments.service'
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'
import { screenTopPadding } from '@/theme/layout'
import { formatCityAndPlace } from '@/utils/location'
import { filterExploreItemsForCelebrated, type ExploreItem } from '@/utils/exploreFilters'

const DEFAULT_FILTERS = (): PublicMatchesListFilters => ({
  search: '',
  city: '',
  status: null,
  hideCelebrated: true,
  startAfter: new Date().toISOString(),
  startBefore: null,
  minFreeSlots: 0,
  contentType: 'all',
})

function statusLabel(status: string) {
  switch (status) {
    case MATCH_STATUS.PLANNED:
      return 'Planificada'
    case MATCH_STATUS.IN_PROGRESS:
      return 'En curso'
    case MATCH_STATUS.FINISHED:
      return 'Finalizada'
    case MATCH_STATUS.FINISHED_NO_RESULT:
      return 'Sin resultado'
    case MATCH_STATUS.CANCELLED:
      return 'Cancelada'
    default:
      return status
  }
}

function tournamentStatusLabel(tournament: TournamentRow) {
  switch (tournament.status) {
    case TOURNAMENT_STATUS.REGISTRATION:
      return tournament.bracket_generated_at ? 'Inscripción' : 'Inscripción abierta'
    case TOURNAMENT_STATUS.IN_PROGRESS:
      return 'En curso'
    case TOURNAMENT_STATUS.FINISHED:
      return 'Finalizado'
    default:
      return tournament.status
  }
}

function matchStatusTone(status: string): StatusDotTone {
  if (status === MATCH_STATUS.IN_PROGRESS) return 'active'
  if (status === MATCH_STATUS.PLANNED) return 'upcoming'
  return 'upcoming'
}

function tournamentStatusTone(tournament: TournamentRow): StatusDotTone {
  if (tournament.status === TOURNAMENT_STATUS.IN_PROGRESS) return 'active'
  if (tournament.status === TOURNAMENT_STATUS.REGISTRATION) return 'upcoming'
  return 'upcoming'
}

function ExploreMatchRow({ row, onPress }: { row: PublicMatchExplorerRow; onPress: () => void }) {
  const tone = matchStatusTone(row.status)
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Partida: ${row.title}`}>
      <StatusDot tone={tone} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.rowMeta}>
          {formatCityAndPlace(row.city, row.place_defined, row.place_text)}
        </Text>
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowStatus, tone === 'active' && styles.rowStatusActive]}>
          {statusLabel(row.status)}
        </Text>
        <Text style={styles.rowDate}>{formatDisplay(row.start_at)}</Text>
        <Text style={styles.rowExtra}>
          {row.free_slots > 0 ? `${row.free_slots} plazas libres` : 'Completa'}
        </Text>
      </View>
    </Pressable>
  )
}

function ExploreTournamentRow({ row, onPress }: { row: TournamentRow; onPress: () => void }) {
  const tone = tournamentStatusTone(row)
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Torneo: ${row.title}`}>
      <StatusDot tone={tone} />
      <View style={styles.rowBody}>
        <Text style={styles.rowKind}>Torneo</Text>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.rowMeta}>
          {formatCityAndPlace(row.city, row.place_defined, row.place_text)}
        </Text>
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowStatus, tone === 'active' && styles.rowStatusActive]}>
          {tournamentStatusLabel(row)}
        </Text>
        <Text style={styles.rowDate}>{formatDisplay(row.start_at)}</Text>
        <Text style={styles.rowExtra}>
          {row.status === TOURNAMENT_STATUS.REGISTRATION ? 'Cuadro pendiente' : 'Ver cuadro'}
        </Text>
      </View>
    </Pressable>
  )
}

export default function ExploreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [filters, setFilters] = useState<PublicMatchesListFilters>(() => DEFAULT_FILTERS())
  const [searchDraft, setSearchDraft] = useState('')
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const [draftCity, setDraftCity] = useState('')
  const [draftStatus, setDraftStatus] = useState<string | null>(null)
  const [draftMinFree, setDraftMinFree] = useState(0)
  const [draftHidePast, setDraftHidePast] = useState(true)
  const [draftDateFromIso, setDraftDateFromIso] = useState<string | null>(null)
  const [draftDateToIso, setDraftDateToIso] = useState<string | null>(null)
  const [draftContentType, setDraftContentType] = useState<ExploreContentType>('all')

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) =>
        f.search === searchDraft.trim() ? f : { ...f, search: searchDraft.trim() }
      )
    }, 350)
    return () => clearTimeout(t)
  }, [searchDraft])

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
  } = useInfinitePublicMatches(filters)

  const tournamentFilters: PublicTournamentsListFilters = useMemo(
    () => ({
      search: filters.search,
      city: filters.city,
      status: filters.status,
      hideCelebrated: filters.hideCelebrated,
      startAfter: filters.startAfter,
      startBefore: filters.startBefore,
      minFreeSlots: filters.minFreeSlots,
      contentType: filters.contentType,
    }),
    [filters]
  )

  const {
    data: tournaments,
    isLoading: tournamentsLoading,
    isRefetching: tournamentsRefetching,
    refetch: refetchTournaments,
  } = usePublicTournamentsExplore(tournamentFilters)

  const matchRows = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data?.pages])

  const exploreItems = useMemo((): ExploreItem[] => {
    const matchItems: ExploreItem[] = matchRows.map((row) => ({
      kind: 'match',
      id: row.id,
      start_at: row.start_at,
      row,
    }))
    const tournamentItems: ExploreItem[] = (tournaments ?? []).map((row) => ({
      kind: 'tournament',
      id: row.id,
      start_at: row.start_at,
      row,
    }))
    const merged = [...matchItems, ...tournamentItems].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    )
    return filterExploreItemsForCelebrated(merged, filters.hideCelebrated)
  }, [matchRows, tournaments, filters.hideCelebrated])

  const refetchAll = useCallback(() => {
    void refetch()
    void refetchTournaments()
  }, [refetch, refetchTournaments])

  const openFilterModal = useCallback(() => {
    setDraftCity(filters.city)
    setDraftStatus(filters.status)
    setDraftMinFree(filters.minFreeSlots)
    setDraftContentType(filters.contentType)
    setDraftHidePast(filters.hideCelebrated)
    setDraftDateFromIso(null)
    setDraftDateToIso(null)
    setFilterModalOpen(true)
  }, [filters])

  const applyFilters = useCallback(() => {
    let startAfter: string | null = null
    if (draftDateFromIso) {
      startAfter = dateToStartOfLocalDayIso(parseIsoToDate(draftDateFromIso))
    } else if (draftHidePast) {
      startAfter = new Date().toISOString()
    }

    let startBefore: string | null = null
    if (draftDateToIso) {
      startBefore = dateToEndOfLocalDayIso(parseIsoToDate(draftDateToIso))
    }

    setFilters((prev) => ({
      ...prev,
      city: draftCity.trim(),
      status: draftStatus,
      minFreeSlots: draftMinFree,
      contentType: draftContentType,
      hideCelebrated: draftHidePast,
      startAfter,
      startBefore,
    }))
    setFilterModalOpen(false)
  }, [
    draftCity,
    draftContentType,
    draftDateFromIso,
    draftDateToIso,
    draftHidePast,
    draftMinFree,
    draftStatus,
  ])

  const clearFilters = useCallback(() => {
    setDraftCity('')
    setDraftStatus(null)
    setDraftMinFree(0)
    setDraftHidePast(true)
    setDraftDateFromIso(null)
    setDraftDateToIso(null)
    setDraftContentType('all')
    setFilters(DEFAULT_FILTERS())
    setSearchDraft('')
    setFilterModalOpen(false)
  }, [])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.city.trim()) n += 1
    if (filters.status) n += 1
    if (filters.minFreeSlots > 0) n += 1
    if (filters.startBefore) n += 1
    if (!filters.hideCelebrated) n += 1
    if (filters.contentType !== 'all') n += 1
    return n
  }, [filters])

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const listHeader = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Descubrir" subtitle="Partidas y torneos públicos" />

      <TextInput
        style={styles.search}
        placeholder="Buscar por título…"
        placeholderTextColor={Colors.textSecondary}
        value={searchDraft}
        onChangeText={setSearchDraft}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Buscar partidas por título"
      />

      <Pressable
        style={styles.filterBtn}
        onPress={openFilterModal}
        accessibilityRole="button"
        accessibilityLabel="Abrir filtros">
        <Text style={styles.filterBtnText}>Filtros</Text>
        {activeFilterCount > 0 ? (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )

  const showMatches = filters.contentType !== 'tournaments'
  const showTournaments = filters.contentType !== 'matches'

  const listFooter = isFetchingNextPage ? (
    <View style={styles.footerLoad}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  ) : hasNextPage && showMatches ? (
    <View style={styles.footerLoad}>
      <Button title="Cargar más" variant="outline" onPress={() => void fetchNextPage()} />
    </View>
  ) : exploreItems.length > 0 ? (
    <Text style={styles.endHint}>No hay más resultados</Text>
  ) : null

  if (
    (showMatches && isLoading && !data) ||
    (showTournaments && tournamentsLoading && !tournaments)
  ) {
    return (
      <View style={[styles.centered, { paddingTop: screenTopPadding(insets.top, 24) }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingHint}>Cargando partidas y torneos…</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: screenTopPadding(insets.top, 24), paddingHorizontal: 24 },
        ]}>
        <Text style={styles.errorTitle}>No se pudo cargar el listado</Text>
        <Text style={styles.errorMsg}>
          {error instanceof Error ? error.message : 'Error desconocido'}
        </Text>
        <Text style={styles.errorHint}>
          Si acabas de actualizar la app, aplica la migración Supabase `009_list_public_matches` en
          tu proyecto.
        </Text>
        <Button title="Reintentar" onPress={() => void refetch()} style={{ marginTop: 16 }} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: screenTopPadding(insets.top) }]}>
      <FlatList
        data={exploreItems}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) =>
          item.kind === 'match' ? (
            <ExploreMatchRow
              row={item.row}
              onPress={() => router.push(`/(tabs)/matches/${item.id}`)}
            />
          ) : (
            <ExploreTournamentRow
              row={item.row}
              onPress={() => router.push(`/(tabs)/tournaments/${item.id}`)}
            />
          )
        }
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 88 }]}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshing={(isRefetching && !isFetchingNextPage) || tournamentsRefetching}
        onRefresh={refetchAll}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nada por aquí</Text>
            <Text style={styles.emptyText}>
              {filters.contentType === 'matches'
                ? 'No hay partidas públicas que coincidan con tu búsqueda y filtros.'
                : filters.contentType === 'tournaments'
                  ? 'No hay torneos públicos que coincidan con tu búsqueda y filtros.'
                  : 'No hay partidas ni torneos públicos que coincidan con tu búsqueda y filtros.'}{' '}
              Prueba a ampliar fechas o quitar filtros.
            </Text>
            <Button
              title="Limpiar filtros"
              variant="outline"
              onPress={clearFilters}
              style={{ marginTop: 12 }}
            />
          </View>
        }
      />

      <CreateFab />

      <Modal visible={filterModalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalRoot, { paddingTop: screenTopPadding(insets.top, 8) }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <Pressable
              onPress={() => setFilterModalOpen(false)}
              accessibilityLabel="Cerrar filtros">
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets>
              <Text style={styles.fieldLabel}>Mostrar</Text>
              <View style={styles.chipsWrap}>
                {(
                  [
                    { id: 'all', label: 'Todo', value: 'all' as ExploreContentType },
                    { id: 'm', label: 'Partidas', value: 'matches' as ExploreContentType },
                    { id: 't', label: 'Torneos', value: 'tournaments' as ExploreContentType },
                  ] as const
                ).map((opt) => {
                  const selected = draftContentType === opt.value
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => setDraftContentType(opt.value)}>
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <MunicipalityPicker
                label="Ciudad o pueblo"
                value={draftCity}
                onChangeText={setDraftCity}
                placeholder="Cualquiera"
              />

              <Text style={styles.fieldLabel}>Estado</Text>
              <View style={styles.chipsWrap}>
                {(
                  [
                    { id: '__all', label: 'Todos', value: null as string | null },
                    { id: 'p', label: 'Planificada', value: MATCH_STATUS.PLANNED },
                    { id: 'i', label: 'En curso', value: MATCH_STATUS.IN_PROGRESS },
                    { id: 'f', label: 'Finalizada', value: MATCH_STATUS.FINISHED },
                    { id: 'fn', label: 'Sin resultado', value: MATCH_STATUS.FINISHED_NO_RESULT },
                  ] as const
                ).map((opt) => {
                  const selected =
                    opt.value === null ? draftStatus === null : draftStatus === opt.value
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => setDraftStatus(opt.value)}>
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.fieldLabel}>Plazas libres (mín.)</Text>
              <View style={styles.segment}>
                {(
                  [
                    { v: 0, t: 'Cualquiera' },
                    { v: 1, t: '≥ 1' },
                    { v: 2, t: '≥ 2' },
                    { v: 3, t: '≥ 3' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.v}
                    style={[styles.segBtn, draftMinFree === opt.v && styles.segBtnOn]}
                    onPress={() => setDraftMinFree(opt.v)}>
                    <Text
                      style={[styles.segBtnText, draftMinFree === opt.v && styles.segBtnTextOn]}>
                      {opt.t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ocultar partidas ya celebradas</Text>
                <Switch
                  value={draftHidePast}
                  onValueChange={setDraftHidePast}
                  trackColor={{ true: Colors.primary, false: Colors.switchTrackOff }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.switchTrackOff}
                />
              </View>
              <Text style={styles.helpMuted}>
                Oculta partidas y torneos ya cerrados o sin resultado, y eventos pasados (salvo
                partidas o torneos aún en curso o con inscripción abierta). Opcional: fecha
                &quot;desde&quot;.
              </Text>

              <Text style={styles.fieldLabel}>Fecha desde (opcional)</Text>
              {draftDateFromIso ? (
                <View>
                  <DateTimePicker
                    label=""
                    value={draftDateFromIso}
                    onChange={setDraftDateFromIso}
                    minDate={new Date(2020, 0, 1)}
                  />
                  <Pressable onPress={() => setDraftDateFromIso(null)} style={styles.clearLink}>
                    <Text style={styles.clearLinkText}>Quitar fecha desde</Text>
                  </Pressable>
                </View>
              ) : (
                <Button
                  title="Elegir fecha desde…"
                  variant="outline"
                  onPress={() => setDraftDateFromIso(dateToLocalIsoString(new Date()))}
                />
              )}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Fecha hasta (opcional)</Text>
              {draftDateToIso ? (
                <View>
                  <DateTimePicker
                    label=""
                    value={draftDateToIso}
                    onChange={setDraftDateToIso}
                    minDate={new Date(2020, 0, 1)}
                  />
                  <Pressable onPress={() => setDraftDateToIso(null)} style={styles.clearLink}>
                    <Text style={styles.clearLinkText}>Quitar fecha hasta</Text>
                  </Pressable>
                </View>
              ) : (
                <Button
                  title="Elegir fecha hasta…"
                  variant="outline"
                  onPress={() => setDraftDateToIso(dateToLocalIsoString(new Date()))}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={[styles.modalActions, { paddingBottom: insets.bottom + 16 }]}>
            <Button title="Limpiar" variant="outline" onPress={clearFilters} style={{ flex: 1 }} />
            <Button title="Aplicar" onPress={applyFilters} style={{ flex: 1, marginLeft: 12 }} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: 20 },
  listHeader: { paddingBottom: 12 },
  search: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  filterBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnText: { color: Colors.textPrimary, fontFamily: Fonts.semiBold, fontSize: 15 },
  filterBadge: {
    marginLeft: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: Colors.white, fontSize: 12, fontFamily: Fonts.bold },
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
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  rowTrailing: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 110 },
  rowStatus: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  rowStatusActive: { color: Colors.primary },
  rowDate: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  rowExtra: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingHint: { marginTop: 12, color: Colors.textSecondary, fontFamily: Fonts.regular },
  errorTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorMsg: { marginTop: 8, color: Colors.danger, textAlign: 'center', fontFamily: Fonts.regular },
  errorHint: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: Fonts.regular,
  },
  footerLoad: { paddingVertical: 20, alignItems: 'center' },
  endHint: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.regular,
    paddingVertical: 12,
  },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 8 },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Fonts.regular,
  },
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 20, fontFamily: Fonts.bold, color: Colors.textPrimary },
  modalClose: { fontSize: 22, color: Colors.textSecondary, padding: 8 },
  modalKeyboard: { flex: 1 },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  chipTextOn: { color: Colors.white, fontFamily: Fonts.semiBold },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  segBtnText: { fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  segBtnTextOn: { color: Colors.primary, fontFamily: Fonts.semiBold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
    paddingRight: 12,
  },
  helpMuted: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    marginTop: 6,
    lineHeight: 16,
  },
  clearLink: { marginTop: 8 },
  clearLinkText: { color: Colors.primary, fontSize: 14, fontFamily: Fonts.medium },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
})
