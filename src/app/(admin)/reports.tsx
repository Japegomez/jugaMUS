import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import {
  useBlockUser,
  useDeleteMatch,
  useDeleteMatchResult,
  useReportsList,
  useResolveReport,
} from '@/hooks/useAdmin'
import type { AdminReport } from '@/services/admin.service'
import type { ReportListFilters } from '@/services/admin.service'

type StatusFilter = ReportListFilters['status']
type TargetFilter = ReportListFilters['targetType']

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

function ReportRow({ report }: { report: AdminReport }) {
  const resolveMutation = useResolveReport()
  const blockMutation = useBlockUser()
  const deleteMatchMutation = useDeleteMatch()
  const deleteResultMutation = useDeleteMatchResult()

  const isPending =
    resolveMutation.isPending ||
    blockMutation.isPending ||
    deleteMatchMutation.isPending ||
    deleteResultMutation.isPending

  const dateStr = new Date(report.created_at).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const onResolve = () => {
    Alert.alert('Resolver reporte', '¿Marcar este reporte como resuelto sin acción adicional?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resolver',
        onPress: () => {
          resolveMutation.mutate(
            { reportId: report.id, actionTaken: 'resolved_no_action' },
            {
              onError: (e) =>
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo resolver'),
            }
          )
        },
      },
    ])
  }

  const onBlockUser = () => {
    if (report.target_type !== 'user') return
    Alert.alert('Bloquear usuario', '¿Suspender la cuenta del usuario reportado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () => {
          blockMutation.mutate(
            { userId: report.target_id, reportId: report.id },
            {
              onError: (e) =>
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo bloquear'),
            }
          )
        },
      },
    ])
  }

  const onDeleteMatch = () => {
    if (report.target_type !== 'match') return
    Alert.alert('Eliminar partida', 'Esta acción no se puede deshacer. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteMatchMutation.mutate(
            { matchId: report.target_id, reportId: report.id },
            {
              onError: (e) =>
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar'),
            }
          )
        },
      },
    ])
  }

  const onDeleteResult = () => {
    if (report.target_type !== 'result') return
    Alert.alert('Eliminar resultado', 'Esta acción no se puede deshacer. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteResultMutation.mutate(
            { resultId: report.target_id, reportId: report.id },
            {
              onError: (e) =>
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar'),
            }
          )
        },
      },
    ])
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.badge}>{report.status === 'open' ? 'Abierto' : 'Resuelto'}</Text>
        <Text style={styles.typeBadge}>{report.target_type}</Text>
      </View>
      <Text style={styles.reason}>{report.reason}</Text>
      {report.notes ? <Text style={styles.notes}>{report.notes}</Text> : null}
      <Text style={styles.meta}>
        Reportado por {report.reporter_display_name ?? '—'} · {dateStr}
      </Text>
      <Text style={styles.metaSmall}>ID objetivo: {report.target_id}</Text>

      {report.status === 'open' ? (
        <View style={styles.actions}>
          <Button
            title="Resolver"
            variant="secondary"
            loading={isPending}
            onPress={onResolve}
            style={styles.actionBtn}
          />
          {report.target_type === 'user' ? (
            <Button
              title="Bloquear usuario"
              variant="danger"
              loading={isPending}
              onPress={onBlockUser}
              style={styles.actionBtn}
            />
          ) : null}
          {report.target_type === 'match' ? (
            <Button
              title="Eliminar partida"
              variant="danger"
              loading={isPending}
              onPress={onDeleteMatch}
              style={styles.actionBtn}
            />
          ) : null}
          {report.target_type === 'result' ? (
            <Button
              title="Eliminar resultado"
              variant="danger"
              loading={isPending}
              onPress={onDeleteResult}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      ) : report.action_taken ? (
        <Text style={styles.resolvedNote}>Acción: {report.action_taken}</Text>
      ) : null}
    </View>
  )
}

export default function AdminReportsScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all')

  const filters = useMemo<ReportListFilters>(
    () => ({ status: statusFilter, targetType: targetFilter }),
    [statusFilter, targetFilter]
  )

  const { data: reports, isLoading, isError, refetch, isRefetching } = useReportsList(filters)

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Estado</Text>
        <View style={styles.chipRow}>
          <FilterChip
            label="Abiertos"
            active={statusFilter === 'open'}
            onPress={() => setStatusFilter('open')}
          />
          <FilterChip
            label="Resueltos"
            active={statusFilter === 'resolved'}
            onPress={() => setStatusFilter('resolved')}
          />
          <FilterChip
            label="Todos"
            active={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
          />
        </View>
        <Text style={styles.filterLabel}>Tipo</Text>
        <View style={styles.chipRow}>
          <FilterChip
            label="Todos"
            active={targetFilter === 'all'}
            onPress={() => setTargetFilter('all')}
          />
          <FilterChip
            label="Usuario"
            active={targetFilter === 'user'}
            onPress={() => setTargetFilter('user')}
          />
          <FilterChip
            label="Partida"
            active={targetFilter === 'match'}
            onPress={() => setTargetFilter('match')}
          />
          <FilterChip
            label="Resultado"
            active={targetFilter === 'result'}
            onPress={() => setTargetFilter('result')}
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#1a5f4a" style={styles.loader} />
      ) : isError ? (
        <Text style={styles.errorText}>No se pudieron cargar los reportes.</Text>
      ) : (
        <FlatList
          data={reports ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReportRow report={item} />}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListEmptyComponent={<Text style={styles.empty}>No hay reportes con estos filtros.</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f4',
  },
  filters: {
    padding: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  chipActive: {
    backgroundColor: '#1a5f4a',
  },
  chipText: {
    fontSize: 13,
    color: '#444',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loader: { marginTop: 32 },
  errorText: {
    padding: 24,
    color: '#b42318',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
    fontSize: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a5f4a',
    backgroundColor: '#e8f5ef',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  reason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  notes: {
    fontSize: 14,
    color: '#555',
    marginTop: 6,
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  metaSmall: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: { minHeight: 40 },
  resolvedNote: {
    fontSize: 13,
    color: '#555',
    marginTop: 8,
    fontStyle: 'italic',
  },
})
