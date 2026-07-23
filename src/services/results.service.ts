import { trackMatchCompletedIfFinished } from '@/lib/analytics'
import { RESULT_STATUS } from '@/constants'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type MatchResultRow = Tables<'match_results'>

export function mapResultRpcError(message: string): string {
  if (message.includes('tie_not_allowed')) return 'No puede haber empate.'
  if (message.includes('winner_must_reach_target')) {
    return 'El ganador debe alcanzar el número de juegos configurado en la partida.'
  }
  if (message.includes('invalid_scores')) return 'Marcador no válido.'
  if (message.includes('result_already_exists'))
    return 'Ya hay un resultado registrado para esta partida.'
  return message
}

export type MatchResultBundle = {
  result: MatchResultRow | null
  /** Current user's confirmation for the latest result row, if any. */
  myConfirmation: { decision: string } | null
}

export type SubmitResultInput = {
  matchId: string
  submittedByUserId: string
  submittedByTeam: string
  teamAGames: number
  teamBGames: number
}

export type SubmitConfirmationInput = {
  matchId: string
  matchResultId: string
  userId: string
  team: string
  decision: 'approve' | 'dispute'
  comment?: string | null
}

export async function fetchMatchResultBundle(
  matchId: string,
  viewerUserId?: string | null
): Promise<MatchResultBundle> {
  const { data: rows, error } = await supabase
    .from('match_results')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)

  const result = (rows?.[0] as MatchResultRow | undefined) ?? null

  if (!result || !viewerUserId) {
    return { result, myConfirmation: null }
  }

  const { data: conf, error: confErr } = await supabase
    .from('result_confirmations')
    .select('decision')
    .eq('match_result_id', result.id)
    .eq('user_id', viewerUserId)
    .maybeSingle()

  if (confErr) throw new Error(confErr.message)

  return {
    result,
    myConfirmation: conf ? { decision: conf.decision } : null,
  }
}

export async function submitResult(input: SubmitResultInput): Promise<MatchResultRow> {
  const { data, error } = await supabase.rpc('submit_match_result', {
    p_match_id: input.matchId,
    p_team_a_games: input.teamAGames,
    p_team_b_games: input.teamBGames,
  })

  if (error) throw new Error(mapResultRpcError(error.message))
  if (!data) throw new Error('No se pudo registrar el resultado')
  const row = data as MatchResultRow
  // Some paths confirm immediately; only count completion when the match is finished.
  if (row.status === RESULT_STATUS.CONFIRMED) {
    await trackMatchCompletedIfFinished(input.matchId)
  }
  return row
}

export async function submitConfirmation({
  matchId,
  matchResultId,
  userId,
  team,
  decision,
  comment,
}: SubmitConfirmationInput): Promise<void> {
  const { error } = await supabase.from('result_confirmations').insert({
    match_result_id: matchResultId,
    user_id: userId,
    team,
    decision,
    comment: comment ?? null,
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya has respondido a este resultado.')
    }
    throw new Error(error.message)
  }

  if (decision === 'approve') {
    await trackMatchCompletedIfFinished(matchId)
  }
}
