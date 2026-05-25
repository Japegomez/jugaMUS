import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { AdminCloseBar } from '@/components/admin/AdminCloseBar'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
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
import { Colors } from '@/theme/colors'
import { Fonts } from '@/theme/typography'

type StatusFilter = ReportListFilters['status']
type TargetFilter = ReportListFilters['targetType']
type PendingAction = 'resolve' | 'block' | 'delete_match' | 'delete_result'

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchStatusLabel(status: string): string {
  switch (status) {
    case 'planned':
      return 'Planificada'
    case 'in_progress':
      return 'En curso'
    case 'finished':
      return 'Finalizada'
    case 'finished_no_result':
      return 'Sin resultado'
    case 'cancelled':
      return 'Cancelada'
    default:
      return status
  }
}

function ReportTargetContext({ report }: { report: AdminReport }) {
  if (report.target_type === 'user') {
    const u = report.target_user
    if (!u) {
      return <Text style={styles.targetMissing}>Usuario no encontrado o eliminado</Text>
    }
    return (
      <View style={styles.targetBox}>
        <Text style={styles.targetLabel}>Usuario reportado</Text>
        <Text style={styles.targetTitle}>{u.display_name}</Text>
        <Text style={styles.targetMeta}>
          {u.status === 'suspended' ? 'Cuenta suspendida' : 'Cuenta activa'}
          {u.city ? ` · ${u.city}` : ''}
        </Text>
      </View>
    )
  }

  if (report.target_type === 'match') {
    const m = report.target_match
    if (!m) {
      return (
        <View style={styles.targetBox}>
          <Text style={styles.targetLabel}>Partida reportada</Text>
          <Text style={styles.targetMissingInline}>
            {report.status === 'resolved'
              ? 'Partida eliminada o ya no disponible'
              : 'Partida no encontrada (puede haberse eliminado antes de resolver el reporte)'}
          </Text>
        </View>
      )
    }
    return (
      <View style={styles.targetBox}>
        <Text style={styles.targetLabel}>Partida reportada</Text>
        <Text style={styles.targetTitle}>{m.title}</Text>
        <Text style={styles.targetMeta}>
          {formatMatchDate(m.start_at)} · {m.city} · {matchStatusLabel(m.status)}
        </Text>
      </View>
    )
  }

  if (report.target_type === 'result') {
    const r = report.target_result
    if (!r) {
      return <Text style={styles.targetMissing}>Resultado no encontrado o eliminado</Text>
    }
    return (
      <View style={styles.targetBox}>
        <Text style={styles.targetLabel}>Resultado reportado</Text>
        <Text style={styles.targetTitle}>
          {r.match_title ?? 'Partida sin título'} — {r.team_a_games}-{r.team_b_games}
        </Text>
        <Text style={styles.targetMeta}>Estado del resultado: {r.result_status}</Text>
      </View>
    )
  }

  return null
}

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
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

  const mutateAsync = (action: PendingAction) => {
    switch (action) {
      case 'resolve':
        return new Promise<void>((resolve, reject) => {
          resolveMutation.mutate(
            { reportId: report.id, actionTaken: 'resolved_no_action' },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          )
        })
      case 'block':
        return new Promise<void>((resolve, reject) => {
          blockMutation.mutate(
            { userId: report.target_id, reportId: report.id },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          )
        })
      case 'delete_match':
        return new Promise<void>((resolve, reject) => {
          deleteMatchMutation.mutate(
            { matchId: report.target_id, reportId: report.id },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          )
        })
      case 'delete_result':
        return new Promise<void>((resolve, reject) => {
          deleteResultMutation.mutate(
            { resultId: report.target_id, reportId: report.id },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          )
        })
      default:
        return Promise.resolve()
    }
  }

  const confirmConfig =
    pendingAction === 'resolve'
      ? {
          title: 'Resolver reporte',
          message:
            'Marcará el reporte como resuelto sin bloquear usuarios ni eliminar contenido. Quedará registrado en el historial de auditoría.',
          confirmLabel: 'Resolver',
          confirmVariant: 'secondary' as const,
        }
      : pendingAction === 'block'
        ? {
            title: 'Bloquear usuario',
            message:
              'Suspenderá la cuenta del usuario reportado. No podrá iniciar sesión hasta que un admin reactive su perfil.',
            confirmLabel: 'Bloquear',
            confirmVariant: 'danger' as const,
          }
        : pendingAction === 'delete_match'
          ? {
              title: 'Eliminar partida',
              message: 'Eliminará la partida reportada. Esta acción no se puede deshacer.',
              confirmLabel: 'Eliminar',
              confirmVariant: 'danger' as const,
            }
          : pendingAction === 'delete_result'
            ? {
                title: 'Eliminar resultado',
                message: 'Eliminará el resultado reportado. Esta acción no se puede deshacer.',
                confirmLabel: 'Eliminar',
                confirmVariant: 'danger' as const,
              }
            : null

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.badge}>{report.status === 'open' ? 'Abierto' : 'Resuelto'}</Text>
        <Text style={styles.typeBadge}>{report.target_type}</Text>
      </View>
      <Text style={styles.reason}>{report.reason}</Text>
      {report.notes ? <Text style={styles.notes}>{report.notes}</Text> : null}
      <ReportTargetContext report={report} />
      <Text style={styles.meta}>
        Reportado por {report.reporter_display_name ?? '—'} · {dateStr}
      </Text>

      {report.status === 'open' ? (
        <View style={styles.actions}>
          <Button
            title="Resolver"
            variant="secondary"
            loading={isPending}
            onPress={() => setPendingAction('resolve')}
            style={styles.actionBtn}
          />
          {report.target_type === 'user' ? (
            <Button
              title="Bloquear usuario"
              variant="danger"
              loading={isPending}
              onPress={() => setPendingAction('block')}
              style={styles.actionBtn}
            />
          ) : null}
          {report.target_type === 'match' ? (
            <Button
              title="Eliminar partida"
              variant="danger"
              loading={isPending}
              onPress={() => setPendingAction('delete_match')}
              style={styles.actionBtn}
            />
          ) : null}
          {report.target_type === 'result' ? (
            <Button
              title="Eliminar resultado"
              variant="danger"
              loading={isPending}
              onPress={() => setPendingAction('delete_result')}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      ) : report.action_taken ? (
        <Text style={styles.resolvedNote}>Acción: {report.action_taken}</Text>
      ) : null}

      {confirmConfig && pendingAction ? (
        <AdminConfirmModal
          visible
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          confirmVariant={confirmConfig.confirmVariant}
          loading={isPending}
          onClose={() => setPendingAction(null)}
          onConfirm={() => mutateAsync(pendingAction)}
        />
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
      <AdminCloseBar />
      <View style={styles.filters}>
        <Text style={styles.screenTitle}>Reportes</Text>
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
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
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
    backgroundColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
    fontFamily: Fonts.semiBold,
  },
  loader: { marginTop: 32 },
  errorText: {
    padding: 24,
    color: Colors.danger,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 32,
    fontSize: 15,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    backgroundColor: Colors.wonBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeBadge: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  reason: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  notes: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  targetBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  targetLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  targetTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  targetMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  targetMissing: {
    fontSize: 13,
    color: Colors.danger,
    marginTop: 10,
    fontStyle: 'italic',
  },
  targetMissingInline: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: { minHeight: 40 },
  resolvedNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
})
