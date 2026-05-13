import { useMutation } from '@tanstack/react-query'

import { useAuthStore } from '@/hooks/useAuth'
import { submitReport, type ReportTargetType } from '@/services/reports.service'

export type SubmitReportPayload = {
  targetType: ReportTargetType
  targetId: string
  reason: string
  notes: string | null
}

export function useSubmitReport() {
  const sessionUserId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: (payload: SubmitReportPayload) => {
      if (!sessionUserId) throw new Error('No autenticado')
      return submitReport({
        ...payload,
        reporterId: sessionUserId,
      })
    },
  })
}
