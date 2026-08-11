import { MATCH_STATUS, MATCH_VISIBILITY, MAX_PLAYERS_PER_TEAM, TEAM } from '@/constants'
import { createSupabaseMock, mockFromChain } from '@/__test-utils__/supabaseMock'

const mockSupabase = createSupabaseMock()

jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

jest.mock('@/lib/analytics', () => ({
  trackMatchCreated: jest.fn(),
  trackMatchJoined: jest.fn(),
  trackMatchCompletedOnce: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/services/tournaments.service', () => ({
  getUserTournamentsDashboard: jest.fn().mockResolvedValue({ upcoming: [], inProgress: [] }),
}))

jest.mock('@/services/leagues.service', () => ({
  getUserLeaguesDashboard: jest.fn().mockResolvedValue({ upcoming: [], inProgress: [] }),
}))

import { trackMatchCompletedOnce, trackMatchCreated, trackMatchJoined } from '@/lib/analytics'
import type { ParticipantWithProfile } from '@/services/matches.service'
import {
  buildMatchTeamEditSlots,
  canEditMatchTeam,
  cancelMatch,
  countTeamSlots,
  createMatch,
  editableTextSlotsForTeam,
  freeTeamSlots,
  getMatch,
  getMyMatchesDashboard,
  getUserMatches,
  getViewableUserMatches,
  grantMatchPasswordAccess,
  isRosterFull,
  joinMatch,
  joinPrivateMatch,
  leaveMatch,
  listPublicMatchesPage,
  maxTextSlotsForTeam,
  recordMatchResultDirect,
  setMatchPassword,
  startMatch,
  updateMatch,
  updateMatchTeam,
  validateTextRosterCapacity,
} from '@/services/matches.service'

function participant(
  userId: string,
  team: string,
  leftAt: string | null = null
): ParticipantWithProfile {
  return {
    id: `part-${userId}`,
    match_id: 'm1',
    user_id: userId,
    team,
    state: 'confirmed',
    joined_at: '2026-01-01T00:00:00Z',
    left_at: leftAt,
    profile: {
      id: userId,
      display_name: `User ${userId}`,
      photo_url: null,
      city: null,
      phone_e164: null,
    },
  }
}

const baseMatch = {
  team_a_player_1: 'Text A1',
  team_a_player_2: null,
  team_b_player_1: null,
  team_b_player_2: null,
}

describe('matches.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.from.mockReset()
    mockSupabase.rpc.mockReset()
  })

  describe('roster helpers', () => {
    const participants = [participant('u1', TEAM.A), participant('u2', TEAM.B)]

    it('countTeamSlots counts active participants per team', () => {
      expect(countTeamSlots(participants, TEAM.A)).toBe(1)
      expect(countTeamSlots([...participants, participant('u3', TEAM.A)], TEAM.A)).toBe(2)
      expect(countTeamSlots([participant('u1', TEAM.A, '2026-01-02T00:00:00Z')], TEAM.A)).toBe(0)
    })

    it('freeTeamSlots subtracts registered and text names from cap', () => {
      expect(freeTeamSlots(baseMatch, participants, TEAM.A)).toBe(0)
      expect(freeTeamSlots(baseMatch, [], TEAM.B)).toBe(MAX_PLAYERS_PER_TEAM)
    })

    it('isRosterFull when both teams have no free slots', () => {
      const fullMatch = {
        team_a_player_1: 'A1',
        team_a_player_2: 'A2',
        team_b_player_1: 'B1',
        team_b_player_2: 'B2',
      }
      expect(isRosterFull(fullMatch, [])).toBe(true)
    })

    it('maxTextSlotsForTeam respects registered count', () => {
      expect(maxTextSlotsForTeam(participants, TEAM.A)).toBe(1)
      expect(maxTextSlotsForTeam([], TEAM.A)).toBe(MAX_PLAYERS_PER_TEAM)
    })

    it('validateTextRosterCapacity returns error when over cap', () => {
      const over = {
        team_a_player_1: 'A1',
        team_a_player_2: 'A2',
        team_b_player_1: null,
        team_b_player_2: null,
      }
      const err = validateTextRosterCapacity([participant('u1', TEAM.A)], over)
      expect(err).toContain('ya está completo')
    })

    it('editableTextSlotsForTeam limits fields by capacity', () => {
      const slots = editableTextSlotsForTeam([], TEAM.B, baseMatch)
      expect(slots).toEqual(['team_b_player_1', 'team_b_player_2'])
    })

    it('buildMatchTeamEditSlots mixes registered and text slots', () => {
      const match = {
        team_a_player_1: 'Ana',
        team_a_player_2: null,
        team_b_player_1: null,
        team_b_player_2: null,
      }
      const slots = buildMatchTeamEditSlots(match, [participant('u1', TEAM.A)], TEAM.A)
      expect(slots.some((s) => s.kind === 'text' && s.field === 'team_a_player_1')).toBe(true)
    })

    it('canEditMatchTeam allows creator both teams on planned standalone match', () => {
      const match = {
        status: MATCH_STATUS.PLANNED,
        tournament_id: null,
        creator_id: 'creator',
      }
      const edit = canEditMatchTeam(match, participants, 'creator')
      expect(edit).toEqual({ canEdit: true, teams: [TEAM.A, TEAM.B] })
    })

    it('canEditMatchTeam restricts participant to own team', () => {
      const match = {
        status: MATCH_STATUS.PLANNED,
        tournament_id: null,
        creator_id: 'creator',
      }
      const edit = canEditMatchTeam(match, participants, 'u1')
      expect(edit).toEqual({ canEdit: true, teams: [TEAM.A] })
    })
  })

  describe('createMatch', () => {
    it('inserts match, joins creator on team A, tracks analytics', async () => {
      const inserted = {
        id: 'm-new',
        status: MATCH_STATUS.PLANNED,
        start_at: '2026-12-01T18:00:00.000Z',
        tournament_id: null,
      }
      const joined = {
        id: 'part1',
        match_id: 'm-new',
        user_id: 'u1',
        team: TEAM.A,
        state: 'confirmed',
        joined_at: '2026-01-01T00:00:00Z',
        left_at: null,
      }

      let matchesFromCalls = 0
      let participantsFromCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          matchesFromCalls += 1
          if (matchesFromCalls === 1) {
            return mockFromChain({ data: inserted, error: null })
          }
          return mockFromChain({ data: { tournament_id: null }, error: null })
        }
        if (table === 'match_participants') {
          participantsFromCalls += 1
          if (participantsFromCalls === 1) {
            return mockFromChain({ data: null, error: null })
          }
          return mockFromChain({ data: joined, error: null })
        }
        return mockFromChain({ data: null, error: null })
      })

      const row = await createMatch('u1', {
        title: 'Partida',
        start_at: '2026-12-01T18:00:00',
        city: 'Madrid',
        place_defined: false,
        duration_target_games: 3,
        visibility: MATCH_VISIBILITY.PUBLIC,
        location_privacy: 'public',
        status: MATCH_STATUS.PLANNED,
        team_a_name: 'A',
        team_b_name: 'B',
      })

      expect(row.id).toBe('m-new')
      expect(trackMatchCreated).toHaveBeenCalledWith('m-new', MATCH_VISIBILITY.PUBLIC)
    })
  })

  describe('joinMatch', () => {
    it('rejects tournament matches', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: { tournament_id: 't1' }, error: null })
      )

      await expect(joinMatch('m1', 'u2', TEAM.B)).rejects.toThrow(
        'Esta partida pertenece a un torneo. Accede desde la ficha del torneo.'
      )
    })

    it('inserts new participant and tracks join', async () => {
      const joined = {
        id: 'p2',
        match_id: 'm1',
        user_id: 'u2',
        team: TEAM.B,
        state: 'confirmed',
        joined_at: '2026-01-01T00:00:00Z',
        left_at: null,
      }

      let participantsFromCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: { tournament_id: null }, error: null })
        }
        if (table === 'match_participants') {
          participantsFromCalls += 1
          if (participantsFromCalls === 1) {
            return mockFromChain({ data: null, error: null })
          }
          return mockFromChain({ data: joined, error: null })
        }
        return mockFromChain({ data: null, error: null })
      })

      const row = await joinMatch('m1', 'u2', TEAM.B)
      expect(row.user_id).toBe('u2')
      expect(trackMatchJoined).toHaveBeenCalledWith('m1', TEAM.B)
    })

    it('throws when already participating', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: { tournament_id: null }, error: null })
        }
        if (table === 'match_participants') {
          return mockFromChain({
            data: { id: 'p1', left_at: null, state: 'confirmed' },
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      await expect(joinMatch('m1', 'u1', TEAM.A)).rejects.toThrow('Ya participas en esta partida.')
    })
  })

  describe('leaveMatch', () => {
    it('marks participant as left', async () => {
      const left = {
        id: 'p1',
        match_id: 'm1',
        user_id: 'u1',
        team: TEAM.A,
        state: 'left',
        joined_at: '2026-01-01T00:00:00Z',
        left_at: '2026-01-02T00:00:00Z',
      }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: left, error: null }))

      const row = await leaveMatch('m1', 'u1')
      expect(row.state).toBe('left')
    })
  })

  describe('cancelMatch', () => {
    it('sets status to cancelled', async () => {
      const cancelled = { id: 'm1', status: MATCH_STATUS.CANCELLED }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: cancelled, error: null }))

      const row = await cancelMatch('m1')
      expect(row.status).toBe(MATCH_STATUS.CANCELLED)
    })
  })

  describe('startMatch', () => {
    it('throws when roster is not full', async () => {
      const matchRow = {
        id: 'm1',
        status: MATCH_STATUS.PLANNED,
        visibility: MATCH_VISIBILITY.PUBLIC,
        tournament_id: null,
        team_a_player_1: null,
        team_a_player_2: null,
        team_b_player_1: null,
        team_b_player_2: null,
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: matchRow, error: null })
        }
        return mockFromChain({ data: null, error: null })
      })
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      await expect(startMatch('m1')).rejects.toThrow('Faltan jugadores')
    })
  })

  describe('recordMatchResultDirect', () => {
    it('calls rpc and tracks completion', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await recordMatchResultDirect('m1', 3, 1)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_match_result_direct', {
        p_match_id: 'm1',
        p_team_a_games: 3,
        p_team_b_games: 1,
      })
      expect(trackMatchCompletedOnce).toHaveBeenCalledWith('m1')
    })

    it('maps rpc errors', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'tie_not_allowed' } })

      await expect(recordMatchResultDirect('m1', 2, 2)).rejects.toThrow('No puede haber empate.')
    })
  })

  describe('getMatch', () => {
    const matchRow = {
      id: 'm1',
      title: 'Partida',
      visibility: MATCH_VISIBILITY.PUBLIC,
      status: MATCH_STATUS.PLANNED,
      start_at: '2026-12-01T18:00:00Z',
      city: 'Madrid',
      place_defined: false,
      place_text: null,
      creator_id: 'u1',
      team_a_player_1: null,
      team_a_player_2: null,
      team_b_player_1: null,
      team_b_player_2: null,
      tournament_id: null,
    }

    it('returns match with roster from rpc', async () => {
      mockSupabase.from.mockReturnValue(mockFromChain({ data: matchRow, error: null }))
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            participant_id: 'p1',
            match_id: 'm1',
            user_id: 'u1',
            team: TEAM.A,
            state: 'confirmed',
            joined_at: '2026-01-01T00:00:00Z',
            left_at: null,
            display_name: 'Ana',
            photo_url: null,
            city: 'Madrid',
          },
        ],
        error: null,
      })

      const match = await getMatch('m1')

      expect(match.id).toBe('m1')
      expect(match.participants).toHaveLength(1)
      expect(match.participants[0].profile.display_name).toBe('Ana')
      expect(match.viewer_has_full_access).toBe(true)
    })

    it('throws when match fetch fails', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'not found' } })
      )

      await expect(getMatch('missing')).rejects.toThrow('not found')
    })

    it('returns empty participants for private match without access', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({
            data: { ...matchRow, visibility: MATCH_VISIBILITY.PRIVATE },
            error: null,
          })
        }
        if (table === 'match_participants') {
          return mockFromChain({
            data: [
              {
                id: 'p1',
                match_id: 'm1',
                user_id: 'u1',
                team: 'A',
                state: 'confirmed',
                joined_at: '2026-01-01T00:00:00Z',
                left_at: null,
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'viewer_can_access_match') {
          return Promise.resolve({ data: false, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const match = await getMatch('m1')

      expect(match.participants).toEqual([])
      expect(match.viewer_has_full_access).toBe(false)
    })

    it('falls back to nested select when roster rpc is missing', async () => {
      let matchesCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          matchesCalls += 1
          if (matchesCalls === 1) {
            return mockFromChain({ data: matchRow, error: null })
          }
          return mockFromChain({
            data: {
              ...matchRow,
              participants: [
                {
                  id: 'p1',
                  match_id: 'm1',
                  user_id: 'u1',
                  team: TEAM.A,
                  state: 'confirmed',
                  joined_at: '2026-01-01T00:00:00Z',
                  left_at: null,
                  profile: {
                    id: 'u1',
                    display_name: 'Ana',
                    photo_url: null,
                    city: 'Madrid',
                  },
                },
              ],
            },
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find function' },
      })

      const match = await getMatch('m1')

      expect(match.participants).toHaveLength(1)
      expect(match.participants[0].profile.phone_e164).toBeNull()
    })
  })

  describe('updateMatch', () => {
    it('updates match fields', async () => {
      const updated = { id: 'm1', title: 'Nuevo título', status: MATCH_STATUS.PLANNED }
      mockSupabase.from.mockReturnValue(mockFromChain({ data: updated, error: null }))

      const row = await updateMatch('m1', { title: 'Nuevo título' })

      expect(row.title).toBe('Nuevo título')
    })

    it('throws on update error', async () => {
      mockSupabase.from.mockReturnValue(
        mockFromChain({ data: null, error: { message: 'update denied' } })
      )

      await expect(updateMatch('m1', { title: 'X' })).rejects.toThrow('update denied')
    })
  })

  describe('private match password', () => {
    it('setMatchPassword calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await setMatchPassword('m1', 'secret')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('set_match_password', {
        p_match_id: 'm1',
        p_password: 'secret',
      })
    })

    it('setMatchPassword maps forbidden error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })

      await expect(setMatchPassword('m1', 'x')).rejects.toThrow(
        'No tienes permiso para modificar esta partida'
      )
    })

    it('grantMatchPasswordAccess calls rpc', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      await grantMatchPasswordAccess('m1', 'secret')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('grant_match_password_access', {
        p_match_id: 'm1',
        p_password: 'secret',
      })
    })

    it('joinPrivateMatch returns participant row', async () => {
      const participantRow = {
        id: 'p1',
        match_id: 'm1',
        user_id: 'u2',
        team: TEAM.B,
        state: 'confirmed',
        joined_at: '2026-01-01T00:00:00Z',
        left_at: null,
      }
      mockSupabase.rpc.mockResolvedValue({ data: participantRow, error: null })

      const row = await joinPrivateMatch('m1', TEAM.B, 'secret')

      expect(row.user_id).toBe('u2')
    })
  })

  describe('updateMatchTeam', () => {
    it('calls update_match_team rpc', async () => {
      const updated = { id: 'm1', team_a_name: 'Equipo A' }
      mockSupabase.rpc.mockResolvedValue({ data: updated, error: null })

      const row = await updateMatchTeam({
        matchId: 'm1',
        team: TEAM.A,
        teamName: 'Equipo A',
        textUpdates: { team_a_player_2: 'Invitado' },
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_match_team',
        expect.objectContaining({
          p_match_id: 'm1',
          p_team: TEAM.A,
          p_team_name: 'Equipo A',
        })
      )
      expect(row.team_a_name).toBe('Equipo A')
    })
  })

  describe('getUserMatches', () => {
    it('merges creator and participant matches with outcomes', async () => {
      const creatorMatch = {
        id: 'm1',
        title: 'Creada',
        start_at: '2026-06-01T18:00:00Z',
        city: 'Madrid',
        place_defined: false,
        place_text: null,
        status: MATCH_STATUS.FINISHED,
        visibility: MATCH_VISIBILITY.PUBLIC,
        creator_id: 'u1',
      }
      const participantMatch = {
        id: 'm2',
        title: 'Unida',
        start_at: '2026-05-01T18:00:00Z',
        city: 'Barcelona',
        place_defined: false,
        place_text: null,
        status: MATCH_STATUS.FINISHED,
        visibility: MATCH_VISIBILITY.PUBLIC,
        creator_id: 'u9',
        tournament_round_size: null,
      }

      let participantFromCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: [creatorMatch], error: null })
        }
        if (table === 'match_participants') {
          participantFromCalls += 1
          if (participantFromCalls === 1) {
            return mockFromChain({
              data: [{ match: participantMatch }],
              error: null,
            })
          }
          return mockFromChain({
            data: [
              { match_id: 'm1', team: TEAM.A },
              { match_id: 'm2', team: TEAM.B },
            ],
            error: null,
          })
        }
        if (table === 'match_results') {
          return mockFromChain({
            data: [
              {
                match_id: 'm1',
                team_a_games: 3,
                team_b_games: 1,
                created_at: '2026-06-02T00:00:00Z',
              },
            ],
            error: null,
          })
        }
        return mockFromChain({ data: null, error: null })
      })

      const rows = await getUserMatches('u1')

      expect(rows.length).toBe(2)
      expect(rows.some((r) => r.id === 'm1')).toBe(true)
      expect(rows.some((r) => r.id === 'm2')).toBe(true)
    })
  })

  describe('getViewableUserMatches', () => {
    it('maps rpc rows to summaries', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'm1',
            title: 'Visible',
            start_at: '2026-06-01T18:00:00Z',
            city: 'Madrid',
            place_defined: false,
            place_text: null,
            status: MATCH_STATUS.FINISHED,
            visibility: MATCH_VISIBILITY.PUBLIC,
            creator_id: 'u2',
            user_team: 'A',
            team_a_games: 3,
            team_b_games: 1,
          },
        ],
        error: null,
      })

      const rows = await getViewableUserMatches('u2')

      expect(rows).toHaveLength(1)
      expect(rows[0].user_team).toBe('A')
      expect(rows[0].outcome).toBeDefined()
    })
  })

  describe('getMyMatchesDashboard', () => {
    it('partitions upcoming and in-progress matches', async () => {
      const future = new Date(Date.now() + 86400000).toISOString()
      const planned = {
        id: 'm-future',
        title: 'Próxima',
        start_at: future,
        city: 'Madrid',
        place_defined: false,
        place_text: null,
        status: MATCH_STATUS.PLANNED,
        visibility: MATCH_VISIBILITY.PUBLIC,
        creator_id: 'u1',
      }
      const live = {
        id: 'm-live',
        title: 'En curso',
        start_at: '2026-01-01T18:00:00Z',
        city: 'Madrid',
        place_defined: false,
        place_text: null,
        status: MATCH_STATUS.IN_PROGRESS,
        visibility: MATCH_VISIBILITY.PUBLIC,
        creator_id: 'u1',
      }

      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: [planned, live], error: null })
        }
        if (table === 'match_participants') {
          return mockFromChain({ data: [], error: null })
        }
        return mockFromChain({ data: [], error: null })
      })

      const dash = await getMyMatchesDashboard('u1')

      expect(dash.upcoming.some((m) => m.id === 'm-future')).toBe(true)
      expect(dash.inProgress.some((m) => m.id === 'm-live')).toBe(true)
      expect(dash.tournamentsUpcoming).toEqual([])
    })

    it('uses client fallback when awaiting rpc is missing', async () => {
      mockSupabase.rpc.mockImplementation((fn: string) => {
        if (fn === 'list_matches_awaiting_my_result_action') {
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST202', message: 'Could not find function' },
          })
        }
        return Promise.resolve({ data: null, error: null })
      })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          return mockFromChain({ data: [], error: null })
        }
        if (table === 'match_participants') {
          return mockFromChain({ data: [], error: null })
        }
        if (table === 'match_results') {
          return mockFromChain({ data: [], error: null })
        }
        if (table === 'result_confirmations') {
          return mockFromChain({ data: [], error: null })
        }
        return mockFromChain({ data: [], error: null })
      })

      const dash = await getMyMatchesDashboard('u1')

      expect(dash.awaitingResultValidation).toEqual([])
    })
  })

  describe('listPublicMatchesPage', () => {
    it('returns paginated explore rows', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'm1',
            title: 'Pública',
            start_at: '2026-12-01T18:00:00Z',
            city: 'Madrid',
            visibility: MATCH_VISIBILITY.PUBLIC,
            status: MATCH_STATUS.PLANNED,
            slots_filled: 2,
            free_slots: 2,
            total_count: 1,
          },
        ],
        error: null,
      })

      const page = await listPublicMatchesPage({
        search: '',
        city: '',
        status: null,
        hideCelebrated: false,
        startAfter: null,
        startBefore: null,
        minFreeSlots: 0,
        contentType: 'matches',
        visibility: 'all',
      })

      expect(page.rows).toHaveLength(1)
      expect(page.total).toBe(1)
      expect(page.rows[0].free_slots).toBe(2)
    })

    it('returns empty page when rpc returns no rows', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      const page = await listPublicMatchesPage({
        search: '',
        city: '',
        status: null,
        hideCelebrated: false,
        startAfter: null,
        startBefore: null,
        minFreeSlots: 0,
        contentType: 'matches',
        visibility: 'all',
      })

      expect(page).toEqual({ rows: [], total: 0, offset: 0 })
    })
  })

  describe('createMatch promote path', () => {
    it('promotes to in_progress when start_at passed and roster full', async () => {
      const pastStart = new Date(Date.now() - 3600000).toISOString()
      const inserted = {
        id: 'm-promote',
        status: MATCH_STATUS.PLANNED,
        start_at: pastStart,
        tournament_id: null,
        team_a_player_1: null,
        team_a_player_2: 'A2',
        team_b_player_1: 'B1',
        team_b_player_2: 'B2',
      }
      const joined = {
        id: 'part1',
        match_id: 'm-promote',
        user_id: 'u1',
        team: TEAM.A,
        state: 'confirmed',
        joined_at: '2026-01-01T00:00:00Z',
        left_at: null,
      }
      const promoted = { ...inserted, status: MATCH_STATUS.IN_PROGRESS }

      let matchesFromCalls = 0
      let participantsFromCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'matches') {
          matchesFromCalls += 1
          if (matchesFromCalls === 1) {
            return mockFromChain({ data: inserted, error: null })
          }
          if (matchesFromCalls === 2) {
            return mockFromChain({ data: { tournament_id: null }, error: null })
          }
          return mockFromChain({ data: promoted, error: null })
        }
        if (table === 'match_participants') {
          participantsFromCalls += 1
          if (participantsFromCalls === 1) {
            return mockFromChain({ data: null, error: null })
          }
          return mockFromChain({ data: joined, error: null })
        }
        return mockFromChain({ data: null, error: null })
      })

      const row = await createMatch('u1', {
        title: 'Auto start',
        start_at: pastStart,
        city: 'Madrid',
        place_defined: false,
        duration_target_games: 3,
        visibility: MATCH_VISIBILITY.PUBLIC,
        location_privacy: 'public',
        status: MATCH_STATUS.PLANNED,
        team_a_name: 'A',
        team_b_name: 'B',
        team_a_player_2: 'A2',
        team_b_player_1: 'B1',
        team_b_player_2: 'B2',
      })

      expect(row.status).toBe(MATCH_STATUS.IN_PROGRESS)
    })
  })
})
