import { LEAGUE_FORMAT, LEAGUE_STATUS, MATCH_VISIBILITY } from '@/constants'
import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

jest.mock('@/lib/analytics', () => ({
  trackMatchCompletedOnce: jest.fn().mockResolvedValue(undefined),
}))

import type { LeaguePairRow } from '@/services/leagues.service'
import {
  acceptLeagueChallenge,
  addLeaguePair,
  canEditLeaguePair,
  canJoinLeaguePair,
  createLeague,
  createLeagueChallenge,
  displayLeaguePairName,
  findUserLeaguePairId,
  generateLeagueFixtures,
  getLeague,
  getUserLeaguesDashboard,
  grantLeaguePasswordAccess,
  isLeaguePairComplete,
  joinLeaguePair,
  leaguePairHasOpenSlot,
  leaguePairMemberLabels,
  listLeagueChallenges,
  listLeagueMatches,
  listLeagueStandings,
  listPublicLeaguesFiltered,
  cancelLeague,
  recordLeagueMatchAsReferee,
  rejectLeagueChallenge,
  removeLeaguePair,
  setLeaguePassword,
  startLeague,
  updateLeague,
  updateLeaguePair,
} from '@/services/leagues.service'

function makeLeaguePair(overrides: Partial<LeaguePairRow> = {}): LeaguePairRow {
  return {
    id: 'lp1',
    league_id: 'l1',
    name: '',
    player_a_user_id: null,
    player_a_text: null,
    player_b_user_id: null,
    player_b_text: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as LeaguePairRow
}

describe('leagues.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
  })

  describe('pair helpers', () => {
    it('isLeaguePairComplete requires both slots', () => {
      expect(isLeaguePairComplete(makeLeaguePair())).toBe(false)
      expect(
        isLeaguePairComplete(makeLeaguePair({ player_a_text: 'A', player_b_user_id: 'u2' }))
      ).toBe(true)
    })

    it('leaguePairMemberLabels builds member list', () => {
      expect(
        leaguePairMemberLabels(
          makeLeaguePair({
            player_a_display_name: 'Ana',
            player_a_user_id: 'u1',
            player_b_text: 'Invitado',
          })
        )
      ).toEqual(['Ana', 'Invitado'])
    })

    it('displayLeaguePairName uses custom name when set', () => {
      expect(
        displayLeaguePairName(makeLeaguePair({ name: 'Dream Team', name_is_custom: true }))
      ).toBe('Dream Team')
    })

    it('leaguePairHasOpenSlot returns slot letter', () => {
      expect(leaguePairHasOpenSlot(makeLeaguePair({ player_a_user_id: 'u1' }))).toBe('b')
    })

    it('findUserLeaguePairId locates user pair', () => {
      const pairs = [makeLeaguePair({ id: 'lp2', player_b_user_id: 'u5' })]
      expect(findUserLeaguePairId(pairs, 'u5')).toBe('lp2')
    })

    it('canEditLeaguePair during registration or in progress', () => {
      const pair = makeLeaguePair({ player_a_user_id: 'u1' })
      expect(canEditLeaguePair(pair, 'u1', false, LEAGUE_STATUS.REGISTRATION)).toBe(true)
      expect(canEditLeaguePair(pair, 'u1', false, LEAGUE_STATUS.FINISHED)).toBe(false)
      expect(canEditLeaguePair(pair, 'org', true, LEAGUE_STATUS.IN_PROGRESS)).toBe(true)
    })

    it('canJoinLeaguePair allows join when slot open and not in another pair', () => {
      const pair = makeLeaguePair({ id: 'lp-open' })
      const joined = canJoinLeaguePair(pair, 'u9', [pair], LEAGUE_STATUS.REGISTRATION)
      expect(joined.canJoin).toBe(true)
      expect(joined.openSlot).toBe('a')
    })
  })

  describe('createLeague', () => {
    it('creates league via rpc', async () => {
      const league = { id: 'l1', title: 'Liga', status: LEAGUE_STATUS.REGISTRATION }
      mockSupabase.rpc.mockResolvedValue({ data: league, error: null })

      const row = await createLeague('u1', {
        title: 'Liga',
        start_at: '2026-06-01T18:00:00',
        city: 'Madrid',
        place_defined: false,
        duration_target_games: 3,
        visibility: MATCH_VISIBILITY.PUBLIC,
        location_privacy: 'public',
        format: LEAGUE_FORMAT.SINGLE_ROUND,
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_league',
        expect.objectContaining({ p_title: 'Liga' })
      )
      expect(row).toEqual(league)
    })

    it('rejects open_elo without end_at before rpc', async () => {
      await expect(
        createLeague('u1', {
          title: 'Abierta',
          start_at: '2026-06-01T18:00:00',
          city: 'Madrid',
          place_defined: false,
          duration_target_games: 3,
          visibility: MATCH_VISIBILITY.PUBLIC,
          location_privacy: 'public',
          format: LEAGUE_FORMAT.OPEN_ELO,
        })
      ).rejects.toThrow('La liga abierta requiere fecha de fin')

      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })
  })

  describe('cancelLeague', () => {
    it('maps league_not_cancellable error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'league_not_cancellable' },
      })

      await expect(cancelLeague('l1')).rejects.toThrow('Esta liga ya no se puede cancelar')
    })

    it('returns league row on success', async () => {
      const cancelled = { id: 'l1', status: LEAGUE_STATUS.CANCELLED }
      mockSupabase.rpc.mockResolvedValue({ data: cancelled, error: null })

      expect((await cancelLeague('l1')).status).toBe(LEAGUE_STATUS.CANCELLED)
    })
  })

  describe('getLeague', () => {
    const league = {
      id: 'l1',
      title: 'Liga',
      visibility: MATCH_VISIBILITY.PUBLIC,
      status: LEAGUE_STATUS.REGISTRATION,
      creator_profile: { display_name: 'Org' },
    }

    it('returns league with pairs', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'leagues') {
          return mockFromChain({ data: league, error: null })
        }
        if (table === 'league_pairs') {
          return mockFromChain({
            data: [
              {
                id: 'lp1',
                league_id: 'l1',
                name: '',
                player_a_user_id: 'u1',
                player_a_text: null,
                player_b_text: 'Guest',
                player_b_user_id: null,
                created_at: '2026-01-01T00:00:00Z',
                player_a_profile: { display_name: 'Ana' },
                player_b_profile: null,
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const row = await getLeague('l1')

      expect(row.pairs).toHaveLength(1)
      expect(row.organizer_display_name).toBe('Org')
    })

    it('hides pairs without access on private league', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({
          data: { ...league, visibility: MATCH_VISIBILITY.PRIVATE },
          error: null,
        })
      )
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null })

      const row = await getLeague('l1')

      expect(row.pairs).toEqual([])
      expect(row.viewer_has_full_access).toBe(false)
    })
  })

  describe('updateLeague', () => {
    it('updates league row', async () => {
      const updated = { id: 'l1', title: 'Nueva liga', status: LEAGUE_STATUS.REGISTRATION }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: updated, error: null }))

      const row = await updateLeague('l1', { title: 'Nueva liga' })

      expect(row.title).toBe('Nueva liga')
    })
  })

  describe('password rpc', () => {
    it('setLeaguePassword calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await setLeaguePassword('l1', 'secret')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('set_league_password', {
        p_league_id: 'l1',
        p_password: 'secret',
      })
    })

    it('grantLeaguePasswordAccess succeeds', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await grantLeaguePasswordAccess('l1', 'secret')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('grant_league_password_access', {
        p_league_id: 'l1',
        p_password: 'secret',
      })
    })
  })

  describe('pair rpc operations', () => {
    const pair = makeLeaguePair({ id: 'lp1', player_a_user_id: 'u1', player_b_text: 'Guest' })

    it('addLeaguePair returns row', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: pair, error: null })

      const row = await addLeaguePair({
        leagueId: 'l1',
        name: 'Pareja',
        playerAUserId: 'u1',
        playerBText: 'Guest',
      })

      expect(row.id).toBe('lp1')
    })

    it('joinLeaguePair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: pair, error: null })

      const row = await joinLeaguePair('lp1', 'b')

      expect(row.id).toBe('lp1')
    })

    it('updateLeaguePair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: { ...pair, name: 'Dream' }, error: null })

      const row = await updateLeaguePair({
        pairId: 'lp1',
        name: 'Dream',
        playerAText: '',
        playerBText: 'Guest',
      })

      expect(row.name).toBe('Dream')
    })

    it('removeLeaguePair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await removeLeaguePair('lp1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_league_pair', { p_pair_id: 'lp1' })
    })
  })

  describe('fixtures and start', () => {
    it('generateLeagueFixtures calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await generateLeagueFixtures('l1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_league_fixtures', {
        p_league_id: 'l1',
      })
    })

    it('startLeague generates fixtures for round-robin', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await startLeague('l1', LEAGUE_FORMAT.SINGLE_ROUND)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_league_fixtures', {
        p_league_id: 'l1',
      })
    })
  })

  describe('list rpc helpers', () => {
    it('listLeagueStandings returns rows', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ pair_id: 'lp1', points: 6, played: 2 }],
        error: null,
      })

      const rows = await listLeagueStandings('l1')

      expect(rows).toHaveLength(1)
    })

    it('listLeagueMatches returns rows', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ match_id: 'm1', round_number: 1 }],
        error: null,
      })

      const rows = await listLeagueMatches('l1')

      expect(rows).toHaveLength(1)
    })

    it('listLeagueChallenges enriches pair names', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'league_challenges') {
          return mockFromChain({
            data: [
              {
                id: 'c1',
                league_id: 'l1',
                challenger_pair_id: 'lp1',
                challenged_pair_id: 'lp2',
                status: 'pending',
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
            error: null,
          })
        }
        if (table === 'league_pairs') {
          return mockFromChain({
            data: [
              { id: 'lp1', name: 'A' },
              { id: 'lp2', name: 'B' },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const rows = await listLeagueChallenges('l1')

      expect(rows[0].challenger_name).toBe('A')
      expect(rows[0].challenged_name).toBe('B')
    })
  })

  describe('challenge rpc', () => {
    const challenge = {
      id: 'c1',
      league_id: 'l1',
      challenger_pair_id: 'lp1',
      challenged_pair_id: 'lp2',
      status: 'pending',
      created_at: '2026-01-01T00:00:00Z',
    }

    it('createLeagueChallenge calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: challenge, error: null })

      const row = await createLeagueChallenge('l1', 'lp2')

      expect(row.id).toBe('c1')
    })

    it('acceptLeagueChallenge calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { ...challenge, status: 'accepted' },
        error: null,
      })

      const row = await acceptLeagueChallenge('c1')

      expect(row.status).toBe('accepted')
    })

    it('rejectLeagueChallenge calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { ...challenge, status: 'rejected' },
        error: null,
      })

      const row = await rejectLeagueChallenge('c1')

      expect(row.status).toBe('rejected')
    })
  })

  describe('listPublicLeaguesFiltered', () => {
    it('returns filtered leagues', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({
          data: [
            {
              id: 'l1',
              title: 'Liga pública',
              visibility: MATCH_VISIBILITY.PUBLIC,
              location_privacy: 'public',
              status: LEAGUE_STATUS.REGISTRATION,
            },
          ],
          error: null,
        })
      )

      const rows = await listPublicLeaguesFiltered({
        search: '',
        city: '',
        status: null,
        hideCelebrated: false,
        startAfter: null,
        startBefore: null,
        minFreeSlots: 0,
        contentType: 'leagues',
        visibility: 'all',
      })

      expect(rows).toHaveLength(1)
    })
  })

  describe('getUserLeaguesDashboard', () => {
    it('partitions upcoming and in-progress leagues', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'leagues') {
          return mockFromChain({
            data: [
              {
                id: 'l1',
                title: 'Registro',
                start_at: '2026-12-01T18:00:00Z',
                end_at: null,
                city: 'Madrid',
                place_defined: false,
                place_text: null,
                status: LEAGUE_STATUS.REGISTRATION,
                format: LEAGUE_FORMAT.SINGLE_ROUND,
                creator_id: 'u1',
                fixtures_generated_at: null,
              },
            ],
            error: null,
          })
        }
        if (table === 'league_pairs') {
          return mockFromChain({
            data: [
              {
                league: {
                  id: 'l2',
                  title: 'En curso',
                  start_at: '2026-06-01T18:00:00Z',
                  end_at: null,
                  city: 'Barcelona',
                  place_defined: false,
                  place_text: null,
                  status: LEAGUE_STATUS.IN_PROGRESS,
                  format: LEAGUE_FORMAT.SINGLE_ROUND,
                  creator_id: 'u9',
                  fixtures_generated_at: '2026-06-01T19:00:00Z',
                },
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const dash = await getUserLeaguesDashboard('u1')

      expect(dash.upcoming.some((l) => l.id === 'l1')).toBe(true)
      expect(dash.inProgress.some((l) => l.id === 'l2')).toBe(true)
    })
  })

  describe('recordLeagueMatchAsReferee', () => {
    it('calls referee rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await recordLeagueMatchAsReferee('m1', 2, 3)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_league_match_result_as_referee', {
        p_match_id: 'm1',
        p_team_a_games: 2,
        p_team_b_games: 3,
      })
    })
  })
})
