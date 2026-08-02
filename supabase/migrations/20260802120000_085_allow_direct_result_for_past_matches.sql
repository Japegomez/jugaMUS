-- 085: Allow the creator to close a newly created past match directly with its result.

CREATE OR REPLACE FUNCTION public.record_match_result_direct(
  p_match_id UUID,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_others INT;
  v_team TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;

  SELECT COUNT(*)::INT INTO v_others
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id <> auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL;

  IF v_others > 0 THEN RAISE EXCEPTION 'has_other_participants'; END IF;
  IF v_match.status NOT IN ('in_progress', 'finished_no_result') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  PERFORM public.validate_match_scores(
    p_team_a_games,
    p_team_b_games,
    v_match.duration_target_games
  );

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  SELECT mp.team INTO v_team
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL
  LIMIT 1;

  v_team := COALESCE(NULLIF(TRIM(v_team), ''), 'A');

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games, submitted_by_team, submitted_by_user_id, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games, v_team, auth.uid(), 'confirmed'
  );

  UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;

  INSERT INTO public.match_state_transitions (
    match_id, from_status, to_status, triggered_by, user_id, reason
  ) VALUES (
    p_match_id, v_match.status, 'finished', 'user', auth.uid(), 'direct result by creator'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_match_result_direct(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_match_result_direct(UUID, INT, INT) TO authenticated;
