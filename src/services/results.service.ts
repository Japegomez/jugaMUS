import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type MatchResultRow = Tables<'match_results'>

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
  const { data, error } = await supabase
    .from('match_results')
    .insert({
      match_id: input.matchId,
      team_a_games: input.teamAGames,
      team_b_games: input.teamBGames,
      submitted_by_team: input.submittedByTeam,
      submitted_by_user_id: input.submittedByUserId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as MatchResultRow
}

export async function submitConfirmation({
  matchId: _matchId,
  matchResultId,
  userId,
  team,
  decision,
  comment,
}: SubmitConfirmationInput): Promise<void> {
  void _matchId
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
}
