import { MATCH_STATUS, TOURNAMENT_STATUS } from '@/constants'
import type { PublicMatchExplorerRow } from '@/services/matches.service'
import type { TournamentRow } from '@/services/tournaments.service'

export type ExploreItem =
  | { kind: 'match'; id: string; start_at: string; row: PublicMatchExplorerRow }
  | { kind: 'tournament'; id: string; start_at: string; row: TournamentRow }

export function filterExploreItemsForCelebrated(
  items: ExploreItem[],
  hideCelebrated: boolean
): ExploreItem[] {
  if (!hideCelebrated) return items

  return items.filter((item) => {
    if (item.kind === 'match') {
      const status = item.row.status
      return status !== MATCH_STATUS.FINISHED && status !== MATCH_STATUS.FINISHED_NO_RESULT
    }
    return item.row.status !== TOURNAMENT_STATUS.FINISHED
  })
}
