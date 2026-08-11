import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

import {
  blockUser,
  deleteMatch,
  deleteMatchResult,
  fetchAdminFeedback,
  fetchAdminReports,
  fetchAnalyticsSummary,
  fetchMatchesByCity,
  fetchMatchesByWeek,
  fetchUserRanking,
  resolveReport,
} from '@/services/admin.service'

describe('admin.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
  })

  describe('fetchAnalyticsSummary', () => {
    it('maps rpc row to AnalyticsSummary', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            mau: '42',
            total_matches: 100,
            matches_this_week: 5,
            pct_confirmed: 80.5,
            pct_disputed: 2,
          },
        ],
        error: null,
      })

      const summary = await fetchAnalyticsSummary()

      expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_get_analytics')
      expect(summary).toEqual({
        mau: 42,
        total_matches: 100,
        matches_this_week: 5,
        pct_confirmed: 80.5,
        pct_disputed: 2,
      })
    })

    it('returns zeros when rpc returns empty', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      const summary = await fetchAnalyticsSummary()

      expect(summary).toEqual({
        mau: 0,
        total_matches: 0,
        matches_this_week: 0,
        pct_confirmed: 0,
        pct_disputed: 0,
      })
    })

    it('throws on rpc error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'metrics fail' } })

      await expect(fetchAnalyticsSummary()).rejects.toThrow('metrics fail')
    })
  })

  describe('fetchMatchesByWeek', () => {
    it('maps rows with numeric count', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ week_start: '2026-01-06', count: '12' }],
        error: null,
      })

      const rows = await fetchMatchesByWeek(8)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_get_matches_by_week', { p_weeks: 8 })
      expect(rows).toEqual([{ week_start: '2026-01-06', count: 12 }])
    })
  })

  describe('fetchMatchesByCity', () => {
    it('maps city ranking rows', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ city: 'Madrid', count: 20 }],
        error: null,
      })

      const rows = await fetchMatchesByCity(5)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('admin_get_matches_by_city', { p_lim: 5 })
      expect(rows[0].city).toBe('Madrid')
      expect(rows[0].count).toBe(20)
    })
  })

  describe('fetchUserRanking', () => {
    it('maps user ranking rows', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ user_id: 'u1', display_name: 'Ana', match_count: '7' }],
        error: null,
      })

      const rows = await fetchUserRanking(10)

      expect(rows).toEqual([{ user_id: 'u1', display_name: 'Ana', match_count: 7 }])
    })
  })

  describe('resolveReport', () => {
    it('updates report and writes audit log on success', async () => {
      const reportsChain = mockFromChain({ data: null, error: null })
      const auditChain = mockFromChain({ data: null, error: null })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reports') return reportsChain
        if (table === 'audit_logs') return auditChain
        return mockFromChain({ data: null, error: null })
      })

      await resolveReport('admin1', 'rep1', 'warned_user')

      expect(reportsChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          action_taken: 'warned_user',
          resolved_by: 'admin1',
        })
      )
      expect(reportsChain.eq).toHaveBeenCalledWith('id', 'rep1')
      expect(auditChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin1',
          action: 'resolve_report',
          target_type: 'report',
          target_id: 'rep1',
        })
      )
    })

    it('throws when report update fails', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'resolve failed' } })
      )

      await expect(resolveReport('admin1', 'rep1', 'action')).rejects.toThrow('resolve failed')
    })
  })

  describe('blockUser', () => {
    it('suspends user and writes audit log', async () => {
      const profilesChain = mockFromChain({ data: null, error: null })
      const auditChain = mockFromChain({ data: null, error: null })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profilesChain
        if (table === 'audit_logs') return auditChain
        return mockFromChain({ data: null, error: null })
      })

      await blockUser('admin1', 'u2')

      expect(profilesChain.update).toHaveBeenCalledWith({ status: 'suspended' })
      expect(profilesChain.eq).toHaveBeenCalledWith('id', 'u2')
      expect(auditChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin1',
          action: 'block_user',
          target_type: 'user',
          target_id: 'u2',
        })
      )
    })

    it('throws when profile update fails', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'block failed' } })
      )

      await expect(blockUser('admin1', 'u2')).rejects.toThrow('block failed')
    })
  })

  describe('fetchAdminReports', () => {
    it('loads reports with enriched targets', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reports') {
          return mockFromChain({
            data: [
              {
                id: 'rep1',
                reporter_id: 'u1',
                target_type: 'user',
                target_id: 'u2',
                status: 'open',
                reason: 'spam',
                created_at: '2026-01-01T00:00:00Z',
                reporter: { display_name: 'Reporter' },
              },
              {
                id: 'rep2',
                reporter_id: 'u1',
                target_type: 'match',
                target_id: 'm1',
                status: 'open',
                reason: 'bad',
                created_at: '2026-01-02T00:00:00Z',
                reporter: { display_name: 'Reporter' },
              },
            ],
            error: null,
          })
        }
        if (table === 'profiles') {
          return mockFromChain({
            data: [{ id: 'u2', display_name: 'Reported', city: 'Madrid', status: 'active' }],
            error: null,
          })
        }
        if (table === 'matches') {
          return mockFromChain({
            data: [
              {
                id: 'm1',
                title: 'Partida',
                city: 'Barcelona',
                start_at: '2026-06-01T18:00:00Z',
                status: 'planned',
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const reports = await fetchAdminReports({ status: 'open', targetType: 'all' })

      expect(reports).toHaveLength(2)
      expect(reports[0].reporter_display_name).toBe('Reporter')
      expect(reports[0].target_user?.display_name).toBe('Reported')
      expect(reports[1].target_match?.title).toBe('Partida')
    })

    it('throws when reports query fails', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'reports fail' } })
      )

      await expect(fetchAdminReports({})).rejects.toThrow('reports fail')
    })
  })

  describe('deleteMatch', () => {
    it('deletes match and writes audit log', async () => {
      const matchesChain = mockFromChain({ data: null, error: null })
      const auditChain = mockFromChain({ data: null, error: null })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') return matchesChain
        if (table === 'audit_logs') return auditChain
        return mockFromChain({ data: null, error: null })
      })

      await deleteMatch('admin1', 'm1')

      expect(matchesChain.delete).toHaveBeenCalled()
      expect(matchesChain.eq).toHaveBeenCalledWith('id', 'm1')
      expect(auditChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin1',
          action: 'delete_match',
          target_type: 'match',
          target_id: 'm1',
        })
      )
    })

    it('throws when delete fails', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'delete fail' } })
      )

      await expect(deleteMatch('admin1', 'm1')).rejects.toThrow('delete fail')
    })
  })

  describe('deleteMatchResult', () => {
    it('deletes result and writes audit log', async () => {
      const resultsChain = mockFromChain({ data: null, error: null })
      const auditChain = mockFromChain({ data: null, error: null })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'match_results') return resultsChain
        if (table === 'audit_logs') return auditChain
        return mockFromChain({ data: null, error: null })
      })

      await deleteMatchResult('admin1', 'r1')

      expect(resultsChain.delete).toHaveBeenCalled()
      expect(resultsChain.eq).toHaveBeenCalledWith('id', 'r1')
      expect(auditChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin1',
          action: 'delete_result',
          target_type: 'result',
          target_id: 'r1',
        })
      )
    })
  })

  describe('fetchAdminFeedback', () => {
    it('returns feedback with user display names', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({
          data: [
            {
              id: 'fb1',
              user_id: 'u1',
              category: 'bug',
              message: 'Crash',
              created_at: '2026-01-01T00:00:00Z',
              user: { display_name: 'Ana' },
            },
          ],
          error: null,
        })
      )

      const rows = await fetchAdminFeedback({ category: 'issue' })

      expect(rows).toHaveLength(1)
      expect(rows[0].user_display_name).toBe('Ana')
    })

    it('throws on query error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'feedback fail' } })
      )

      await expect(fetchAdminFeedback({})).rejects.toThrow('feedback fail')
    })
  })

  describe('audit log failure', () => {
    it('resolveReport throws when audit insert fails', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reports') {
          return mockFromChain({ data: null, error: null })
        }
        if (table === 'audit_logs') {
          return mockFromChain({ data: null, error: { message: 'audit fail' } })
        }
        return mockFromChain({ data: null, error: null })
      })

      await expect(resolveReport('admin1', 'rep1', 'action')).rejects.toThrow('audit fail')
    })
  })
})
