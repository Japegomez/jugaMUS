import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  hasIncompleteMatchRoster,
  isMatchStartAtPast,
  requiresFutureStartAtForIncompleteRoster,
} from '@/utils/matchCreateForm'

describe('matchCreateForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('detects past start_at by minute (current minute is allowed)', () => {
    const now = new Date('2026-06-03T12:00:45')
    expect(isMatchStartAtPast('2026-06-03T11:59:00', now)).toBe(true)
    expect(isMatchStartAtPast('2026-06-03T12:00:00', now)).toBe(false)
    expect(isMatchStartAtPast('2026-06-03T12:01:00', now)).toBe(false)
  })

  it('detects incomplete roster', () => {
    expect(
      hasIncompleteMatchRoster({
        team_a_player_2: 'Ana',
        team_b_player_1: 'Luis',
        team_b_player_2: '',
      })
    ).toBe(true)
    expect(
      hasIncompleteMatchRoster({
        team_a_player_2: 'Ana',
        team_b_player_1: 'Luis',
        team_b_player_2: 'Pepe',
      })
    ).toBe(false)
  })

  it('requires future date only when past and roster incomplete', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T12:00:00'))
    const roster = { team_a_player_2: '', team_b_player_1: '', team_b_player_2: '' }
    expect(requiresFutureStartAtForIncompleteRoster('2026-06-03T10:00:00', roster)).toBe(true)
    expect(requiresFutureStartAtForIncompleteRoster('2026-06-03T14:00:00', roster)).toBe(false)
    expect(
      requiresFutureStartAtForIncompleteRoster('2026-06-03T10:00:00', {
        team_a_player_2: 'A',
        team_b_player_1: 'B',
        team_b_player_2: 'C',
      })
    ).toBe(false)
  })
})
