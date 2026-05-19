import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database.types'

export type AdminReport = Tables<'reports'> & {
  reporter_display_name: string | null
}

export type ReportListFilters = {
  status?: 'open' | 'resolved' | 'all'
  targetType?: 'user' | 'match' | 'result' | 'all'
}

export type AuditLogInsert = {
  action: string
  target_type: 'report' | 'user' | 'match' | 'result'
  target_id: string
  details?: Record<string, unknown> | null
}

export type AnalyticsSummary = {
  mau: number
  total_matches: number
  matches_this_week: number
  pct_confirmed: number
  pct_disputed: number
}

export type MatchesByWeekRow = { week_start: string; count: number }
export type MatchesByCityRow = { city: string; count: number }
export type UserRankingRow = { user_id: string; display_name: string; match_count: number }

async function writeAuditLog(adminId: string, entry: AuditLogInsert): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    admin_id: adminId,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    details: (entry.details ?? null) as Json | null,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo registrar la auditoría')
  }
}

export async function fetchAdminReports(filters: ReportListFilters): Promise<AdminReport[]> {
  let query = supabase
    .from('reports')
    .select(
      `
      *,
      reporter:profiles!reports_reporter_id_fkey(display_name)
    `
    )
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.targetType && filters.targetType !== 'all') {
    query = query.eq('target_type', filters.targetType)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los reportes')
  }

  return (data ?? []).map((row) => {
    const { reporter, ...report } = row as Tables<'reports'> & {
      reporter: { display_name: string } | null
    }
    return {
      ...report,
      reporter_display_name: reporter?.display_name ?? null,
    }
  })
}

export async function resolveReport(
  adminId: string,
  reportId: string,
  actionTaken: string
): Promise<void> {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      action_taken: actionTaken,
      resolved_at: now,
      resolved_by: adminId,
    })
    .eq('id', reportId)

  if (error) {
    throw new Error(error.message || 'No se pudo resolver el reporte')
  }

  await writeAuditLog(adminId, {
    action: 'resolve_report',
    target_type: 'report',
    target_id: reportId,
    details: { action_taken: actionTaken },
  })
}

export async function blockUser(adminId: string, userId: string, reportId?: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ status: 'suspended' }).eq('id', userId)

  if (error) {
    throw new Error(error.message || 'No se pudo bloquear al usuario')
  }

  await writeAuditLog(adminId, {
    action: 'block_user',
    target_type: 'user',
    target_id: userId,
    details: reportId ? { report_id: reportId } : null,
  })
}

export async function deleteMatch(
  adminId: string,
  matchId: string,
  reportId?: string
): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar la partida')
  }

  await writeAuditLog(adminId, {
    action: 'delete_match',
    target_type: 'match',
    target_id: matchId,
    details: reportId ? { report_id: reportId } : null,
  })
}

export async function deleteMatchResult(
  adminId: string,
  resultId: string,
  reportId?: string
): Promise<void> {
  const { error } = await supabase.from('match_results').delete().eq('id', resultId)

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el resultado')
  }

  await writeAuditLog(adminId, {
    action: 'delete_result',
    target_type: 'result',
    target_id: resultId,
    details: reportId ? { report_id: reportId } : null,
  })
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const { data, error } = await supabase.rpc('admin_get_analytics')

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las métricas')
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return {
      mau: 0,
      total_matches: 0,
      matches_this_week: 0,
      pct_confirmed: 0,
      pct_disputed: 0,
    }
  }

  return {
    mau: Number(row.mau ?? 0),
    total_matches: Number(row.total_matches ?? 0),
    matches_this_week: Number(row.matches_this_week ?? 0),
    pct_confirmed: Number(row.pct_confirmed ?? 0),
    pct_disputed: Number(row.pct_disputed ?? 0),
  }
}

export async function fetchMatchesByWeek(weeks = 12): Promise<MatchesByWeekRow[]> {
  const { data, error } = await supabase.rpc('admin_get_matches_by_week', { p_weeks: weeks })

  if (error) {
    throw new Error(error.message || 'No se pudo cargar la serie semanal')
  }

  return (data ?? []).map((r) => ({
    week_start: String(r.week_start),
    count: Number(r.count ?? 0),
  }))
}

export async function fetchMatchesByCity(limit = 10): Promise<MatchesByCityRow[]> {
  const { data, error } = await supabase.rpc('admin_get_matches_by_city', { p_lim: limit })

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el ranking por ciudad')
  }

  return (data ?? []).map((r) => ({
    city: String(r.city),
    count: Number(r.count ?? 0),
  }))
}

export async function fetchUserRanking(limit = 20): Promise<UserRankingRow[]> {
  const { data, error } = await supabase.rpc('admin_get_user_ranking', { p_lim: limit })

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el ranking de usuarios')
  }

  return (data ?? []).map((r) => ({
    user_id: String(r.user_id),
    display_name: String(r.display_name),
    match_count: Number(r.match_count ?? 0),
  }))
}
