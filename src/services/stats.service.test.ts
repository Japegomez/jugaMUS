import { createSupabaseMock } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

import {
  getLeaderboard,
  getMatchInsights,
  getPlayerRanking,
  getPlayerStats,
} from '@/services/stats.service'

describe('stats.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.rpc.mockReset()
  })

  describe('getPlayerStats', () => {
    it('parses raw rpc JSON into PlayerStats shape', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          user_id: 'u1',
          elo_rating: '1250',
          matches_played: 10,
          wins: 6,
          losses: 4,
          win_rate: 0.6,
          current_streak: 2,
          best_win_streak: 5,
          last_form: ['won', 'lost', 'invalid'],
          badges: [{ key: 'first_win', earned_at: '2026-01-01' }, { foo: 'bar' }],
          tournaments_won: 1,
          tournament_finals: 2,
          tournament_thirds: 0,
          tournaments_participated: 3,
          leagues_participated: 1,
          podium: {
            gold: [{ id: 't1', title: 'Torneo A', start_at: '2026-01-01', source: 'tournament' }],
            silver: [],
            bronze: [],
          },
          venues: [{ city: 'Madrid', place_text: null, matches: 5, wins: 3, win_rate: 0.6 }],
          partners: [
            {
              user_id: 'u2',
              display_name: 'Pareja',
              photo_url: null,
              matches: 4,
              wins: 2,
              win_rate: 0.5,
            },
          ],
          rivalries: {
            nemesis: {
              user_id: 'u3',
              display_name: 'Nemesis',
              photo_url: null,
              matches: 5,
              wins: 1,
              losses: 4,
            },
            best_victim: null,
            most_faced: null,
          },
        },
        error: null,
      })

      const stats = await getPlayerStats('u1')

      expect(stats.user_id).toBe('u1')
      expect(stats.elo_rating).toBe(1250)
      expect(stats.last_form).toEqual(['won', 'lost'])
      expect(stats.badges).toEqual([{ key: 'first_win', earned_at: '2026-01-01' }])
      expect(stats.podium.gold[0].source).toBe('tournament')
      expect(stats.rivalries.nemesis?.display_name).toBe('Nemesis')
    })

    it('throws when rpc returns unparseable data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: { bad: true }, error: null })

      await expect(getPlayerStats('u1')).rejects.toThrow('No se pudieron cargar las estadísticas')
    })

    it('includes error code in message when present', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'denied', code: '42501' },
      })

      await expect(getPlayerStats('u1')).rejects.toThrow('Estadísticas (42501): denied')
    })
  })

  describe('getMatchInsights', () => {
    it('parses match insights from rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          match_id: 'm1',
          players: [
            {
              user_id: 'u1',
              display_name: 'A',
              team: 'A',
              elo_rating: 1200,
              last_form: ['won'],
            },
          ],
          individual_h2h: [
            { user_a: 'u1', user_b: 'u2', wins_a: 2, wins_b: 1, last_meeting: '2026-01-01' },
          ],
          pair_h2h: { wins_a: 3, wins_b: 2, last_meeting: null },
        },
        error: null,
      })

      const insights = await getMatchInsights('m1', 'viewer')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_match_player_insights', {
        p_match_id: 'm1',
        p_viewer_id: 'viewer',
      })
      expect(insights.match_id).toBe('m1')
      expect(insights.players[0].display_name).toBe('A')
      expect(insights.pair_h2h?.wins_a).toBe(3)
    })
  })

  describe('getLeaderboard', () => {
    it('parses leaderboard entries and trims city filter', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            user_id: 'u1',
            display_name: 'Top',
            photo_url: null,
            city: 'Madrid',
            elo_rating: '1300',
            matches_played: 20,
            wins: 15,
            losses: 5,
            win_rate: 0.75,
          },
        ],
        error: null,
      })

      const rows = await getLeaderboard('  Madrid  ', 25)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_leaderboard', {
        p_city: 'Madrid',
        p_limit: 25,
      })
      expect(rows[0].elo_rating).toBe(1300)
    })

    it('passes undefined city when blank', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      await getLeaderboard('   ')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_leaderboard', {
        p_city: undefined,
        p_limit: 50,
      })
    })
  })

  describe('getPlayerRanking', () => {
    it('parses ranking with nullable ranks', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          user_id: 'u1',
          city: '  ',
          elo_rating: 1100,
          global_rank: 5,
          city_rank: null,
          global_total: 100,
          city_total: null,
        },
        error: null,
      })

      const ranking = await getPlayerRanking('u1')

      expect(ranking.global_rank).toBe(5)
      expect(ranking.city).toBeNull()
      expect(ranking.city_rank).toBeNull()
    })
  })
})
