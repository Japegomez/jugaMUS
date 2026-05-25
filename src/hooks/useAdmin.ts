import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/hooks/useAuth'
import {
  blockUser,
  deleteMatch,
  deleteMatchResult,
  fetchAdminReports,
  resolveReport,
  type ReportListFilters,
} from '@/services/admin.service'

export const adminReportsQueryKey = (filters: ReportListFilters) =>
  ['admin', 'reports', filters] as const

export function useReportsList(filters: ReportListFilters) {
  return useQuery({
    queryKey: adminReportsQueryKey(filters),
    queryFn: () => fetchAdminReports(filters),
  })
}

export function useResolveReport() {
  const queryClient = useQueryClient()
  const adminId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ reportId, actionTaken }: { reportId: string; actionTaken: string }) => {
      if (!adminId) throw new Error('No autenticado')
      return resolveReport(adminId, reportId, actionTaken)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}

export function useBlockUser() {
  const queryClient = useQueryClient()
  const adminId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ userId, reportId }: { userId: string; reportId?: string }) => {
      if (!adminId) throw new Error('No autenticado')
      return blockUser(adminId, userId, reportId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}

export function useDeleteMatch() {
  const queryClient = useQueryClient()
  const adminId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ matchId, reportId }: { matchId: string; reportId?: string }) => {
      if (!adminId) throw new Error('No autenticado')
      return deleteMatch(adminId, matchId, reportId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}

export function useDeleteMatchResult() {
  const queryClient = useQueryClient()
  const adminId = useAuthStore((s) => s.session?.user.id)

  return useMutation({
    mutationFn: ({ resultId, reportId }: { resultId: string; reportId?: string }) => {
      if (!adminId) throw new Error('No autenticado')
      return deleteMatchResult(adminId, resultId, reportId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}
