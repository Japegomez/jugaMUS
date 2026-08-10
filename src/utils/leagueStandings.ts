export type StandingMatchResult = {
  pairAId: string
  pairBId: string
  teamAGames: number
  teamBGames: number
}

export type StandingPairInput = {
  id: string
  name: string
  currentElo?: number
}

export type StandingRow = {
  pairId: string
  pairName: string
  played: number
  wins: number
  losses: number
  gamesFor: number
  gamesAgainst: number
  gamesDiff: number
  h2hWins: number
  currentElo: number
  rank: number
}

/**
 * Round-robin standings:
 * wins → head-to-head wins among tied → games diff → games for → pair id.
 */
export function computeLeagueStandings(
  pairs: StandingPairInput[],
  results: StandingMatchResult[]
): StandingRow[] {
  const stats = new Map<
    string,
    {
      name: string
      currentElo: number
      played: number
      wins: number
      losses: number
      gamesFor: number
      gamesAgainst: number
    }
  >()

  for (const p of pairs) {
    stats.set(p.id, {
      name: p.name,
      currentElo: p.currentElo ?? 1000,
      played: 0,
      wins: 0,
      losses: 0,
      gamesFor: 0,
      gamesAgainst: 0,
    })
  }

  for (const r of results) {
    const a = stats.get(r.pairAId)
    const b = stats.get(r.pairBId)
    if (!a || !b) continue

    a.played += 1
    b.played += 1
    a.gamesFor += r.teamAGames
    a.gamesAgainst += r.teamBGames
    b.gamesFor += r.teamBGames
    b.gamesAgainst += r.teamAGames

    if (r.teamAGames > r.teamBGames) {
      a.wins += 1
      b.losses += 1
    } else {
      b.wins += 1
      a.losses += 1
    }
  }

  const h2hWinsAmongTied = (pairId: string, wins: number): number => {
    let count = 0
    const tiedIds = pairs.filter((p) => (stats.get(p.id)?.wins ?? 0) === wins).map((p) => p.id)
    for (const otherId of tiedIds) {
      if (otherId === pairId) continue
      for (const r of results) {
        const involves =
          (r.pairAId === pairId && r.pairBId === otherId) ||
          (r.pairBId === pairId && r.pairAId === otherId)
        if (!involves) continue
        const pairWon =
          (r.pairAId === pairId && r.teamAGames > r.teamBGames) ||
          (r.pairBId === pairId && r.teamBGames > r.teamAGames)
        if (pairWon) count += 1
      }
    }
    return count
  }

  const rows: Omit<StandingRow, 'rank'>[] = pairs.map((p) => {
    const s = stats.get(p.id)!
    return {
      pairId: p.id,
      pairName: s.name,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      gamesFor: s.gamesFor,
      gamesAgainst: s.gamesAgainst,
      gamesDiff: s.gamesFor - s.gamesAgainst,
      h2hWins: h2hWinsAmongTied(p.id, s.wins),
      currentElo: s.currentElo,
    }
  })

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.h2hWins !== a.h2hWins) return b.h2hWins - a.h2hWins
    if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor
    return a.pairId.localeCompare(b.pairId)
  })

  return rows.map((row, index) => ({ ...row, rank: index + 1 }))
}
