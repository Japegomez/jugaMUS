import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportTargetType = 'user' | 'match' | 'result'

export type SubmitReportInput = {
  targetType: ReportTargetType
  targetId: string
  reason: string
  notes: string | null
  reporterId: string
}

/** Motivos mostrados en UI; el valor guardado en `reason` es el texto visible (moderación legible). */
export const REPORT_REASONS: Record<ReportTargetType, readonly string[]> = {
  match: [
    'Lugar o información incorrectos',
    'Partida falsa o no celebrada',
    'Comportamiento inapropiado del organizador',
    'Otro',
  ],
  user: [
    'Comportamiento inapropiado',
    'Acoso o intimidación',
    'Información falsa en perfil',
    'No se presentó a la partida',
    'Otro',
  ],
  result: ['Resultado incorrecto', 'Resultado introducido de forma fraudulenta', 'Otro'],
} as const

// ─── API ─────────────────────────────────────────────────────────────────────

export async function submitReport(input: SubmitReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    reporter_id: input.reporterId,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo enviar el reporte')
  }
}
