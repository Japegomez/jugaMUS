import { supabase } from '@/lib/supabase'

export type FormOutcome = 'won' | 'lost'

export type PlayerBadge = {
  key: string
  earned_at: string
}

export type VenueStat = {
  city: string
  place_text: string | null
  matches: number
  wins: number
  win_rate: number
}

export type PartnerStat = {
  user_id: string
  display_name: string
  photo_url: string | null
  matches: number
  wins: number
  win_rate: number
}

export type RivalStat = {
  user_id: string
  display_name: string
  photo_url: string | null
  matches: number
  wins: number
  losses: number
}

export type PodiumSource = 'tournament' | 'league'

export type PodiumEntry = {
  id: string
  title: string
  start_at: string
  source: PodiumSource
}

export type Podium = {
  gold: PodiumEntry[]
  silver: PodiumEntry[]
  bronze: PodiumEntry[]
}

/** @deprecated Use PodiumEntry */
export type TournamentPodiumEntry = PodiumEntry & { tournament_id?: string }

/** @deprecated Use Podium */
export type TournamentPodium = Podium

export type PlayerStats = {
  user_id: string
  elo_rating: number
  matches_played: number
  wins: number
  losses: number
  win_rate: number
  current_streak: number
  best_win_streak: number
  last_form: FormOutcome[]
  badges: PlayerBadge[]
  tournaments_won: number
  tournament_finals: number
  tournament_thirds: number
  tournaments_participated: number
  leagues_participated: number
  podium: Podium
  venues: VenueStat[]
  partners: PartnerStat[]
  rivalries: {
    nemesis: RivalStat | null
    best_victim: RivalStat | null
    most_faced: RivalStat | null
  }
}

export type MatchInsightPlayer = {
  user_id: string
  display_name: string
  photo_url: string | null
  team: 'A' | 'B' | string
  elo_rating: number
  matches_played: number
  wins: number
  losses: number
  win_rate: number
  current_streak: number
  last_form: FormOutcome[]
}

export type IndividualH2H = {
  user_a: string
  user_b: string
  wins_a: number
  wins_b: number
  last_meeting: string | null
}

export type PairH2H = {
  wins_a: number
  wins_b: number
  last_meeting: string | null
}

export type MatchInsights = {
  match_id: string
  players: MatchInsightPlayer[]
  individual_h2h: IndividualH2H[]
  pair_h2h: PairH2H | null
}

export type LeaderboardEntry = {
  user_id: string
  display_name: string
  photo_url: string | null
  city: string | null
  elo_rating: number
  matches_played: number
  wins: number
  losses: number
  win_rate: number
}

export type PlayerRanking = {
  user_id: string
  city: string | null
  elo_rating: number
  global_rank: number | null
  city_rank: number | null
  global_total: number
  city_total: number | null
}

function asForm(value: unknown): FormOutcome[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is FormOutcome => v === 'won' || v === 'lost')
}

function asBadges(value: unknown): PlayerBadge[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.key !== 'string') return null
      return {
        key: row.key,
        earned_at: typeof row.earned_at === 'string' ? row.earned_at : '',
      }
    })
    .filter((b): b is PlayerBadge => b != null)
}

function asRival(value: unknown): RivalStat | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.user_id !== 'string' || typeof row.display_name !== 'string') return null
  return {
    user_id: row.user_id,
    display_name: row.display_name,
    photo_url: typeof row.photo_url === 'string' ? row.photo_url : null,
    matches: Number(row.matches ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
  }
}

function asPodiumSource(value: unknown): PodiumSource {
  return value === 'league' ? 'league' : 'tournament'
}

function asPodiumEntries(value: unknown): PodiumEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>
      const id =
        typeof row.id === 'string'
          ? row.id
          : typeof row.tournament_id === 'string'
            ? row.tournament_id
            : typeof row.league_id === 'string'
              ? row.league_id
              : null
      if (!id || typeof row.title !== 'string') return null
      return {
        id,
        title: row.title,
        start_at: typeof row.start_at === 'string' ? row.start_at : '',
        source: asPodiumSource(row.source),
      }
    })
    .filter((e): e is PodiumEntry => e != null)
}

function asPodium(value: unknown): Podium {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    gold: asPodiumEntries(row.gold),
    silver: asPodiumEntries(row.silver),
    bronze: asPodiumEntries(row.bronze),
  }
}

function parsePlayerStats(raw: unknown): PlayerStats | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.user_id !== 'string') return null

  const rivalriesRaw =
    row.rivalries && typeof row.rivalries === 'object'
      ? (row.rivalries as Record<string, unknown>)
      : {}

  return {
    user_id: row.user_id,
    elo_rating: Number(row.elo_rating ?? 1200),
    matches_played: Number(row.matches_played ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    win_rate: Number(row.win_rate ?? 0),
    current_streak: Number(row.current_streak ?? 0),
    best_win_streak: Number(row.best_win_streak ?? 0),
    last_form: asForm(row.last_form),
    badges: asBadges(row.badges),
    tournaments_won: Number(row.tournaments_won ?? 0),
    tournament_finals: Number(row.tournament_finals ?? 0),
    tournament_thirds: Number(row.tournament_thirds ?? 0),
    tournaments_participated: Number(row.tournaments_participated ?? 0),
    leagues_participated: Number(row.leagues_participated ?? 0),
    podium: asPodium(row.podium ?? row.tournament_podium),
    venues: Array.isArray(row.venues)
      ? row.venues.map((v) => {
          const venue = (v ?? {}) as Record<string, unknown>
          return {
            city: String(venue.city ?? ''),
            place_text: typeof venue.place_text === 'string' ? venue.place_text : null,
            matches: Number(venue.matches ?? 0),
            wins: Number(venue.wins ?? 0),
            win_rate: Number(venue.win_rate ?? 0),
          }
        })
      : [],
    partners: Array.isArray(row.partners)
      ? row.partners.map((p) => {
          const partner = (p ?? {}) as Record<string, unknown>
          return {
            user_id: String(partner.user_id ?? ''),
            display_name: String(partner.display_name ?? ''),
            photo_url: typeof partner.photo_url === 'string' ? partner.photo_url : null,
            matches: Number(partner.matches ?? 0),
            wins: Number(partner.wins ?? 0),
            win_rate: Number(partner.win_rate ?? 0),
          }
        })
      : [],
    rivalries: {
      nemesis: asRival(rivalriesRaw.nemesis),
      best_victim: asRival(rivalriesRaw.best_victim),
      most_faced: asRival(rivalriesRaw.most_faced),
    },
  }
}

function parseMatchInsights(raw: unknown): MatchInsights | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.match_id !== 'string') return null

  const players: MatchInsightPlayer[] = Array.isArray(row.players)
    ? row.players.map((p) => {
        const player = (p ?? {}) as Record<string, unknown>
        return {
          user_id: String(player.user_id ?? ''),
          display_name: String(player.display_name ?? ''),
          photo_url: typeof player.photo_url === 'string' ? player.photo_url : null,
          team: String(player.team ?? ''),
          elo_rating: Number(player.elo_rating ?? 1200),
          matches_played: Number(player.matches_played ?? 0),
          wins: Number(player.wins ?? 0),
          losses: Number(player.losses ?? 0),
          win_rate: Number(player.win_rate ?? 0),
          current_streak: Number(player.current_streak ?? 0),
          last_form: asForm(player.last_form),
        }
      })
    : []

  const individual_h2h: IndividualH2H[] = Array.isArray(row.individual_h2h)
    ? row.individual_h2h.map((h) => {
        const item = (h ?? {}) as Record<string, unknown>
        return {
          user_a: String(item.user_a ?? ''),
          user_b: String(item.user_b ?? ''),
          wins_a: Number(item.wins_a ?? 0),
          wins_b: Number(item.wins_b ?? 0),
          last_meeting: typeof item.last_meeting === 'string' ? item.last_meeting : null,
        }
      })
    : []

  let pair_h2h: PairH2H | null = null
  if (row.pair_h2h && typeof row.pair_h2h === 'object') {
    const pair = row.pair_h2h as Record<string, unknown>
    pair_h2h = {
      wins_a: Number(pair.wins_a ?? 0),
      wins_b: Number(pair.wins_b ?? 0),
      last_meeting: typeof pair.last_meeting === 'string' ? pair.last_meeting : null,
    }
  }

  return {
    match_id: row.match_id,
    players,
    individual_h2h,
    pair_h2h,
  }
}

function parseLeaderboard(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>
    return {
      user_id: String(row.user_id ?? ''),
      display_name: String(row.display_name ?? ''),
      photo_url: typeof row.photo_url === 'string' ? row.photo_url : null,
      city: typeof row.city === 'string' ? row.city : null,
      elo_rating: Number(row.elo_rating ?? 1200),
      matches_played: Number(row.matches_played ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      win_rate: Number(row.win_rate ?? 0),
    }
  })
}

export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  const { data, error } = await supabase.rpc('get_player_stats', { p_user_id: userId })
  if (error) {
    const details =
      typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined
    throw new Error(details ? `Estadísticas (${details}): ${error.message}` : error.message)
  }
  const parsed = parsePlayerStats(data)
  if (!parsed) throw new Error('No se pudieron cargar las estadísticas')
  return parsed
}

export async function getMatchInsights(
  matchId: string,
  viewerId?: string | null
): Promise<MatchInsights> {
  const { data, error } = await supabase.rpc('get_match_player_insights', {
    p_match_id: matchId,
    p_viewer_id: viewerId ?? undefined,
  })
  if (error) throw new Error(error.message)
  const parsed = parseMatchInsights(data)
  if (!parsed) throw new Error('No se pudieron cargar las estadísticas de la partida')
  return parsed
}

export async function getLeaderboard(
  city?: string | null,
  limit = 50
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_city: city?.trim() ? city.trim() : undefined,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  return parseLeaderboard(data)
}

function parsePlayerRanking(raw: unknown): PlayerRanking | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.user_id !== 'string') return null
  return {
    user_id: row.user_id,
    city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : null,
    elo_rating: Number(row.elo_rating ?? 1200),
    global_rank: row.global_rank == null ? null : Number(row.global_rank),
    city_rank: row.city_rank == null ? null : Number(row.city_rank),
    global_total: Number(row.global_total ?? 0),
    city_total: row.city_total == null ? null : Number(row.city_total),
  }
}

export async function getPlayerRanking(userId: string): Promise<PlayerRanking> {
  const { data, error } = await supabase.rpc('get_player_ranking', { p_user_id: userId })
  if (error) throw new Error(error.message)
  const parsed = parsePlayerRanking(data)
  if (!parsed) throw new Error('No se pudo cargar el ranking')
  return parsed
}

export const BADGE_LABELS: Record<string, string> = {
  first_win: 'Primera victoria',
  wins_10: '10 victorias',
  wins_25: '25 victorias',
  wins_50: '50 victorias',
  wins_100: '100 victorias',
  tournament_winner: 'Campeón de torneo',
  tournament_finalist: 'Finalista',
  league_winner: 'Campeón de liga',
  league_runner_up: 'Subcampeón de liga',
  league_podium: 'Podio de liga',
  league_regular: 'Habitual de ligas',
  streak_5: 'Racha de 5',
  streak_10: 'Racha de 10',
  streak_breaker: 'Romperracha',
  double_champion: 'Doblete',
  veteran_50: 'Veterano (50)',
  veteran_100: 'Veterano (100)',
  explorer_5: 'Explorador',
  explorer_20: 'La vuelta al mundo',
  nemesis_confirmed: 'Cazador de rivales',
  crown_5: 'Pentacampeón',
  crown_10: 'Leyenda (10 títulos)',
  league_crown_3: 'Rey de ligas',
  rivalry_10: 'Rival de manual',
}

export const BADGE_CATALOG: ReadonlyArray<{
  key: keyof typeof BADGE_LABELS
  emoji: string
  hint: string
}> = [
  { key: 'first_win', emoji: '🎉', hint: 'Gana tu primera partida' },
  { key: 'wins_10', emoji: '🔟', hint: 'Acumula 10 victorias' },
  { key: 'wins_25', emoji: '💪', hint: 'Acumula 25 victorias' },
  { key: 'wins_50', emoji: '🔥', hint: 'Acumula 50 victorias' },
  { key: 'wins_100', emoji: '💯', hint: 'Acumula 100 victorias' },
  { key: 'tournament_winner', emoji: '🏆', hint: 'Gana un torneo' },
  { key: 'tournament_finalist', emoji: '🥈', hint: 'Juega una final de torneo' },
  { key: 'league_winner', emoji: '🥇', hint: 'Queda 1º en una liga' },
  { key: 'league_runner_up', emoji: '🎗️', hint: 'Queda 2º en una liga' },
  { key: 'league_podium', emoji: '🏅', hint: 'Termina entre los 3 primeros de una liga' },
  { key: 'league_regular', emoji: '📅', hint: 'Completa 3 ligas' },
  { key: 'streak_5', emoji: '⚡', hint: 'Encadena 5 victorias' },
  { key: 'streak_10', emoji: '🚀', hint: 'Encadena 10 victorias' },
  {
    key: 'streak_breaker',
    emoji: '🪓',
    hint: 'Derrota a un rival con 9 victorias seguidas (le impides la Racha de 10)',
  },
  {
    key: 'double_champion',
    emoji: '💎',
    hint: 'Sé campeón de un torneo y de una liga',
  },
  { key: 'veteran_50', emoji: '🛡️', hint: 'Juega 50 partidas' },
  { key: 'veteran_100', emoji: '📜', hint: 'Juega 100 partidas' },
  { key: 'explorer_5', emoji: '🗺️', hint: 'Juega en 5 sitios distintos' },
  { key: 'explorer_20', emoji: '🌍', hint: 'Juega en 20 sitios distintos' },
  { key: 'nemesis_confirmed', emoji: '🎯', hint: 'Gana 5 veces al mismo rival' },
  { key: 'rivalry_10', emoji: '🤜', hint: 'Gana 10 veces al mismo rival' },
  { key: 'crown_5', emoji: '🏰', hint: 'Gana 5 torneos' },
  { key: 'crown_10', emoji: '🌟', hint: 'Gana 10 torneos' },
  { key: 'league_crown_3', emoji: '🔱', hint: 'Gana 3 ligas' },
]

export function formatStreak(streak: number): string {
  if (streak === 0) return '—'
  if (streak > 0) return `${streak}V`
  return `${Math.abs(streak)}D`
}
