import { DEFAULT_TEAM_A_NAME, DEFAULT_TEAM_B_NAME, TEAM } from '@/constants'
import {
  collectTeamPlayerNames,
  collectTeamRosterEntries,
  formatTeamNameFromPlayers,
  isUnspecifiedTeamName,
  resolveTeamName,
  type TeamRosterParticipant,
} from '@/utils/matchTeamNames'

function participant(
  team: string,
  displayName: string,
  joinedAt = '2026-01-01T10:00:00Z'
): TeamRosterParticipant {
  return {
    team,
    joined_at: joinedAt,
    left_at: null,
    profile: { display_name: displayName },
  }
}

const baseMatch = {
  team_a_name: '',
  team_b_name: '',
  team_a_player_1: null,
  team_a_player_2: null,
  team_b_player_1: null,
  team_b_player_2: null,
}

describe('matchTeamNames', () => {
  it('treats empty and legacy defaults as unspecified', () => {
    expect(isUnspecifiedTeamName('', TEAM.A)).toBe(true)
    expect(isUnspecifiedTeamName(DEFAULT_TEAM_A_NAME, TEAM.A)).toBe(true)
    expect(isUnspecifiedTeamName('Los Cracks', TEAM.A)).toBe(false)
  })

  it('collects registered creator and text companion on team A', () => {
    expect(
      collectTeamPlayerNames(
        { ...baseMatch, team_a_player_2: 'Pepe' },
        [participant(TEAM.A, 'Juan')],
        TEAM.A
      )
    ).toEqual(['Juan', 'Pepe'])
  })

  it('builds default name from players when team name is empty', () => {
    expect(
      resolveTeamName({ ...baseMatch, team_a_player_2: 'Pepe' }, TEAM.A, [
        participant(TEAM.A, 'Juan'),
      ])
    ).toBe('Juan - Pepe')
  })

  it('keeps custom team name when provided', () => {
    expect(
      resolveTeamName(
        { ...baseMatch, team_a_name: 'Los Nuestros', team_a_player_2: 'Pepe' },
        TEAM.A,
        [participant(TEAM.A, 'Juan')]
      )
    ).toBe('Los Nuestros')
  })

  it('falls back to Equipo A/B when no players', () => {
    expect(resolveTeamName(baseMatch, TEAM.A, [])).toBe(DEFAULT_TEAM_A_NAME)
    expect(resolveTeamName(baseMatch, TEAM.B, [])).toBe(DEFAULT_TEAM_B_NAME)
  })

  it('joins two player names with hyphen', () => {
    expect(formatTeamNameFromPlayers(['Ana', 'Luis'])).toBe('Ana - Luis')
  })

  it('includes two registered players on team B when no text names', () => {
    expect(
      resolveTeamName(baseMatch, TEAM.B, [
        participant(TEAM.B, 'Ana', '2026-01-01T10:00:00Z'),
        participant(TEAM.B, 'Luis', '2026-01-01T11:00:00Z'),
      ])
    ).toBe('Ana - Luis')
  })

  it('includes registered player with text rival on team B', () => {
    expect(
      resolveTeamName({ ...baseMatch, team_b_player_1: 'Ana' }, TEAM.B, [
        participant(TEAM.B, 'Carlos'),
      ])
    ).toBe('Ana - Carlos')
  })

  it('prioritizes registered slot 1 on team A even if team_a_player_1 has text', () => {
    expect(
      resolveTeamName(
        { ...baseMatch, team_a_player_1: 'Legacy', team_a_player_2: 'Pepe' },
        TEAM.A,
        [participant(TEAM.A, 'Juan')]
      )
    ).toBe('Juan - Pepe')
  })

  it('uses only registered creator on team A when no companion', () => {
    expect(resolveTeamName(baseMatch, TEAM.A, [participant(TEAM.A, 'Juan')])).toBe('Juan')
  })

  it('lists roster entries in the same order as the default team name', () => {
    const entries = collectTeamRosterEntries(
      { ...baseMatch, team_a_player_2: 'Pepe' },
      [participant(TEAM.A, 'Juan')],
      TEAM.A
    )
    expect(
      entries.map((e) => (e.kind === 'registered' ? e.participant.profile.display_name : e.name))
    ).toEqual(['Juan', 'Pepe'])
  })
})
