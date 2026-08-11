import { MATCH_VISIBILITY, TOURNAMENT_STATUS } from '@/constants'
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

import type { TournamentPairRow } from '@/services/tournaments.service'
import {
  addTournamentPair,
  canEditTournamentPair,
  canJoinTournamentPair,
  cancelTournament,
  createTournament,
  displayPairName,
  findUserTournamentPairId,
  generateTournamentBracket,
  getTournament,
  getTournamentBracket,
  getUserTournamentsDashboard,
  grantTournamentPasswordAccess,
  isTournamentPairComplete,
  joinTournamentPair,
  listPublicTournamentsFiltered,
  pairHasOpenSlot,
  pairMemberLabels,
  recordTournamentMatchAsReferee,
  removeTournamentPair,
  setTournamentPassword,
  updateTournament,
  updateTournamentPair,
  userIsInTournamentPair,
  userIsTournamentPairMember,
} from '@/services/tournaments.service'

function makePair(overrides: Partial<TournamentPairRow> = {}): TournamentPairRow {
  return {
    id: 'p1',
    tournament_id: 't1',
    name: '',
    player_a_user_id: null,
    player_a_text: null,
    player_b_user_id: null,
    player_b_text: null,
    entry_fee_paid: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TournamentPairRow
}

describe('tournaments.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
  })

  describe('pair helpers', () => {
    it('isTournamentPairComplete requires both slots filled', () => {
      expect(isTournamentPairComplete(makePair())).toBe(false)
      expect(
        isTournamentPairComplete(makePair({ player_a_user_id: 'u1', player_b_text: 'Guest B' }))
      ).toBe(true)
    })

    it('pairMemberLabels prefers display names for registered players', () => {
      const labels = pairMemberLabels(
        makePair({
          player_a_user_id: 'u1',
          player_a_display_name: 'Ana',
          player_b_text: 'Bob',
        })
      )
      expect(labels).toEqual(['Ana', 'Bob'])
    })

    it('displayPairName uses custom name when flagged', () => {
      const name = displayPairName(makePair({ name: 'Los Campeones', name_is_custom: true }))
      expect(name).toBe('Los Campeones')
    })

    it('displayPairName falls back to Pareja', () => {
      expect(displayPairName(makePair())).toBe('Pareja')
    })

    it('pairHasOpenSlot returns first free slot', () => {
      expect(pairHasOpenSlot(makePair())).toBe('a')
      expect(pairHasOpenSlot(makePair({ player_a_user_id: 'u1' }))).toBe('b')
      expect(
        pairHasOpenSlot(makePair({ player_a_user_id: 'u1', player_b_user_id: 'u2' }))
      ).toBeNull()
    })

    it('findUserTournamentPairId and userIsInTournamentPair', () => {
      const pairs = [makePair({ id: 'p1', player_b_user_id: 'u2' })]
      expect(findUserTournamentPairId(pairs, 'u2')).toBe('p1')
      expect(userIsInTournamentPair(pairs, 'u9')).toBe(false)
    })

    it('userIsTournamentPairMember checks membership', () => {
      const pair = makePair({ player_a_user_id: 'u1' })
      expect(userIsTournamentPairMember(pair, 'u1')).toBe(true)
      expect(userIsTournamentPairMember(pair, undefined)).toBe(false)
    })

    it('canEditTournamentPair allows creator or member during registration', () => {
      const pair = makePair({ player_a_user_id: 'u1' })
      expect(canEditTournamentPair(pair, 'u1', false, true, false)).toBe(true)
      expect(canEditTournamentPair(pair, 'u1', false, true, true)).toBe(false)
      expect(canEditTournamentPair(pair, 'admin', true, true, false)).toBe(true)
    })

    it('canJoinTournamentPair blocks when user already in another pair', () => {
      const openPair = makePair({ id: 'p-open' })
      const otherPair = makePair({ id: 'p-other', player_a_user_id: 'u1' })
      const result = canJoinTournamentPair(openPair, 'u2', [openPair, otherPair], true)
      expect(result.canJoin).toBe(true)
      expect(result.openSlot).toBe('a')

      const blocked = canJoinTournamentPair(openPair, 'u1', [openPair, otherPair], true)
      expect(blocked.canJoin).toBe(false)
    })
  })

  describe('createTournament', () => {
    it('calls create_tournament rpc and returns row', async () => {
      const tournament = {
        id: 't1',
        title: 'Torneo',
        visibility: MATCH_VISIBILITY.PUBLIC,
        status: TOURNAMENT_STATUS.REGISTRATION,
      }
      mockSupabase.rpc.mockResolvedValue({ data: tournament, error: null })

      const row = await createTournament('u1', {
        title: 'Torneo',
        start_at: '2026-06-01T18:00:00',
        city: 'Madrid',
        place_defined: false,
        duration_target_games: 3,
        visibility: MATCH_VISIBILITY.PUBLIC,
        location_privacy: 'public',
        creator_joins_as_player: false,
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_tournament',
        expect.objectContaining({ p_title: 'Torneo', p_city: 'Madrid' })
      )
      expect(row).toEqual(tournament)
    })

    it('throws on rpc error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'create failed' } })

      await expect(
        createTournament('u1', {
          title: 'X',
          start_at: '2026-06-01T18:00:00',
          city: 'Madrid',
          place_defined: false,
          duration_target_games: 3,
          visibility: MATCH_VISIBILITY.PUBLIC,
          location_privacy: 'public',
        })
      ).rejects.toThrow('create failed')
    })
  })

  describe('cancelTournament', () => {
    it('maps forbidden error to Spanish message', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })

      await expect(cancelTournament('t1')).rejects.toThrow(
        'Solo el organizador puede cancelar el torneo'
      )
    })

    it('returns cancelled tournament on success', async () => {
      const cancelled = { id: 't1', status: TOURNAMENT_STATUS.CANCELLED }
      mockSupabase.rpc.mockResolvedValue({ data: cancelled, error: null })

      const row = await cancelTournament('t1')
      expect(row.status).toBe(TOURNAMENT_STATUS.CANCELLED)
    })
  })

  describe('getTournament', () => {
    const tournament = {
      id: 't1',
      title: 'Torneo',
      visibility: MATCH_VISIBILITY.PUBLIC,
      status: TOURNAMENT_STATUS.REGISTRATION,
      creator_profile: { display_name: 'Org' },
    }

    it('returns tournament with pairs', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tournaments') {
          return mockFromChain({ data: tournament, error: null })
        }
        if (table === 'tournament_pairs') {
          return mockFromChain({
            data: [
              {
                id: 'p1',
                tournament_id: 't1',
                name: '',
                player_a_user_id: 'u1',
                player_a_text: null,
                player_b_text: 'Guest',
                player_b_user_id: null,
                entry_fee_paid: false,
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

      const row = await getTournament('t1')

      expect(row.pairs).toHaveLength(1)
      expect(row.organizer_display_name).toBe('Org')
      expect(row.viewer_has_full_access).toBe(true)
    })

    it('hides pairs for private tournament without access', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tournaments') {
          return mockFromChain({
            data: { ...tournament, visibility: MATCH_VISIBILITY.PRIVATE },
            error: null,
          })
        }
        if (table === 'tournament_pairs') {
          return mockFromChain({
            data: [
              {
                id: 'p1',
                tournament_id: 't1',
                name: '',
                player_a_user_id: 'u1',
                player_a_text: null,
                player_b_text: 'Guest',
                player_b_user_id: null,
                entry_fee_paid: false,
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
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null })

      const row = await getTournament('t1')

      expect(row.pairs).toEqual([])
      expect(row.viewer_has_full_access).toBe(false)
    })
  })

  describe('updateTournament', () => {
    it('updates tournament row', async () => {
      const updated = { id: 't1', title: 'Nuevo', status: TOURNAMENT_STATUS.REGISTRATION }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: updated, error: null }))

      const row = await updateTournament('t1', { title: 'Nuevo' })

      expect(row.title).toBe('Nuevo')
    })
  })

  describe('password rpc', () => {
    it('setTournamentPassword calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await setTournamentPassword('t1', 'secret')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('set_tournament_password', {
        p_tournament_id: 't1',
        p_password: 'secret',
      })
    })

    it('grantTournamentPasswordAccess maps wrong password', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'wrong_password' } })

      await expect(grantTournamentPasswordAccess('t1', 'bad')).rejects.toThrow(
        'Contraseña incorrecta'
      )
    })
  })

  describe('pair rpc operations', () => {
    const pair = makePair({ id: 'p1', player_a_user_id: 'u1', player_b_text: 'Guest' })

    it('addTournamentPair returns rpc row', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: pair, error: null })

      const row = await addTournamentPair({
        tournamentId: 't1',
        name: 'Pareja',
        playerAUserId: 'u1',
        playerBText: 'Guest',
      })

      expect(row.id).toBe('p1')
    })

    it('joinTournamentPair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: pair, error: null })

      const row = await joinTournamentPair('p1', 'b', 'Invitado')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_tournament_pair', {
        p_pair_id: 'p1',
        p_slot: 'b',
        p_as_text: 'Invitado',
      })
      expect(row.id).toBe('p1')
    })

    it('updateTournamentPair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: { ...pair, name: 'Los Pro' }, error: null })

      const row = await updateTournamentPair({
        pairId: 'p1',
        name: 'Los Pro',
        playerAText: '',
        playerBText: 'Guest',
      })

      expect(row.name).toBe('Los Pro')
    })

    it('removeTournamentPair calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await removeTournamentPair('p1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_tournament_pair', { p_pair_id: 'p1' })
    })
  })

  describe('bracket', () => {
    it('generateTournamentBracket calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await generateTournamentBracket('t1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_tournament_bracket', {
        p_tournament_id: 't1',
      })
    })

    it('getTournamentBracket returns nodes', async () => {
      const tournament = {
        id: 't1',
        title: 'Torneo',
        visibility: MATCH_VISIBILITY.PUBLIC,
        status: TOURNAMENT_STATUS.IN_PROGRESS,
        creator_profile: { display_name: 'Org' },
      }
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tournaments') {
          return mockFromChain({ data: tournament, error: null })
        }
        if (table === 'tournament_pairs') {
          return mockFromChain({ data: [], error: null })
        }
        return mockFromChain({ data: null, error: null })
      })
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'list_tournament_bracket') {
          return Promise.resolve({
            data: [{ match_id: 'm1', round: 1, position: 1 }],
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const bracket = await getTournamentBracket('t1')

      expect(bracket.nodes).toHaveLength(1)
      expect(bracket.tournament.id).toBe('t1')
    })
  })

  describe('listPublicTournamentsFiltered', () => {
    it('returns public tournaments', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({
          data: [{ id: 't1', title: 'Abierto', visibility: MATCH_VISIBILITY.PUBLIC }],
          error: null,
        })
      )

      const rows = await listPublicTournamentsFiltered({
        search: '',
        city: '',
        status: null,
        hideCelebrated: false,
        startAfter: null,
        startBefore: null,
        minFreeSlots: 0,
        contentType: 'tournaments',
        visibility: 'all',
      })

      expect(rows).toHaveLength(1)
    })

    it('returns empty when minFreeSlots filter set', async () => {
      const rows = await listPublicTournamentsFiltered({
        search: '',
        city: '',
        status: null,
        hideCelebrated: false,
        startAfter: null,
        startBefore: null,
        minFreeSlots: 2,
        contentType: 'tournaments',
        visibility: 'all',
      })

      expect(rows).toEqual([])
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('getUserTournamentsDashboard', () => {
    it('merges organizer and participant tournaments', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tournaments') {
          return mockFromChain({
            data: [
              {
                id: 't1',
                title: 'Org',
                start_at: '2026-12-01T18:00:00Z',
                city: 'Madrid',
                place_defined: false,
                place_text: null,
                status: TOURNAMENT_STATUS.REGISTRATION,
                creator_id: 'u1',
                bracket_generated_at: null,
              },
            ],
            error: null,
          })
        }
        if (table === 'tournament_pairs') {
          return mockFromChain({
            data: [
              {
                tournament: {
                  id: 't2',
                  title: 'Jugando',
                  start_at: '2026-11-01T18:00:00Z',
                  city: 'Barcelona',
                  place_defined: false,
                  place_text: null,
                  status: TOURNAMENT_STATUS.IN_PROGRESS,
                  creator_id: 'u9',
                  bracket_generated_at: '2026-11-01T19:00:00Z',
                },
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const dash = await getUserTournamentsDashboard('u1')

      expect(dash.upcoming.some((t) => t.id === 't1')).toBe(true)
      expect(dash.inProgress.some((t) => t.id === 't2')).toBe(true)
    })
  })

  describe('recordTournamentMatchAsReferee', () => {
    it('calls referee rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await recordTournamentMatchAsReferee('m1', 3, 1)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_tournament_match_result_as_referee', {
        p_match_id: 'm1',
        p_team_a_games: 3,
        p_team_b_games: 1,
      })
    })
  })
})
