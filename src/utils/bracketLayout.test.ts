import { buildBracketLayout, expandBracketNodes } from '@/utils/bracketLayout'
import type { BracketNodeRow } from '@/services/tournaments.service'

describe('buildBracketLayout', () => {
  it('returns empty layout for no nodes', () => {
    const layout = buildBracketLayout([])
    expect(layout.nodes).toHaveLength(0)
    expect(layout.width).toBe(0)
  })

  it('positions nodes in distinct columns by round', () => {
    const nodes: BracketNodeRow[] = [
      {
        match_id: 'm1',
        round_size: 4,
        bracket_position: 0,
        pair_a_id: 'p1',
        pair_a_name: 'A',
        pair_b_id: 'p2',
        pair_b_name: 'B',
        winner_pair_id: null,
        match_status: 'in_progress',
        is_bye: false,
        team_a_games: null,
        team_b_games: null,
        start_at: new Date().toISOString(),
      },
      {
        match_id: 'm2',
        round_size: 2,
        bracket_position: 0,
        pair_a_id: null,
        pair_a_name: 'TBD',
        pair_b_id: null,
        pair_b_name: 'TBD',
        winner_pair_id: null,
        match_status: 'planned',
        is_bye: false,
        team_a_games: null,
        team_b_games: null,
        start_at: new Date().toISOString(),
      },
    ]

    const layout = buildBracketLayout(nodes)
    expect(layout.nodes.length).toBeGreaterThanOrEqual(2)
    expect(layout.nodes[0].x).toBeLessThan(layout.nodes[layout.nodes.length - 1].x)
  })

  it('expands missing later-round slots', () => {
    const nodes: BracketNodeRow[] = [
      {
        match_id: 'm1',
        round_size: 4,
        bracket_position: 0,
        pair_a_id: 'p1',
        pair_a_name: 'A',
        pair_b_id: 'p2',
        pair_b_name: 'B',
        winner_pair_id: null,
        match_status: 'in_progress',
        is_bye: false,
        team_a_games: null,
        team_b_games: null,
        start_at: new Date().toISOString(),
      },
    ]

    const expanded = expandBracketNodes(nodes)
    expect(expanded).toHaveLength(3)
    expect(expanded.some((n) => n.round_size === 2)).toBe(true)
  })
})
