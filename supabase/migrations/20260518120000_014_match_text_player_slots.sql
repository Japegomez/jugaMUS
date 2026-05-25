-- Migration 014: optional text player slots on matches + direct result RPC for creator-only matches.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_a_player_1 TEXT,
  ADD COLUMN IF NOT EXISTS team_a_player_2 TEXT,
  ADD COLUMN IF NOT EXISTS team_b_player_1 TEXT,
  ADD COLUMN IF NOT EXISTS team_b_player_2 TEXT;

-- Creators can read results for their own matches (personal / text-only rosters).
CREATE POLICY match_results_select_creator ON public.match_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_results.match_id
        AND m.creator_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_match_result_direct(
  p_match_id UUID,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_others INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_creator';
  END IF;

  SELECT COUNT(*)::INT INTO v_others
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id <> auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL;

  IF v_others > 0 THEN
    RAISE EXCEPTION 'has_other_participants';
  END IF;

  IF v_match.status NOT IN ('planned', 'in_progress', 'finished_no_result') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  IF p_team_a_games < 0 OR p_team_a_games > 6 OR p_team_b_games < 0 OR p_team_b_games > 6 THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id
      AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  INSERT INTO public.match_results (
    match_id,
    team_a_games,
    team_b_games,
    submitted_by_team,
    submitted_by_user_id,
    status
  ) VALUES (
    p_match_id,
    p_team_a_games,
    p_team_b_games,
    'A',
    auth.uid(),
    'confirmed'
  );

  IF v_match.status <> 'finished' THEN
    UPDATE public.matches
    SET status = 'finished', updated_at = NOW()
    WHERE id = p_match_id;

    INSERT INTO public.match_state_transitions (
      match_id, from_status, to_status, triggered_by, user_id, reason
    ) VALUES (
      p_match_id,
      v_match.status,
      'finished',
      'user',
      auth.uid(),
      'direct result by creator'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_match_result_direct(UUID, INT, INT) TO authenticated;
