-- 030: submit_match_result RPC — score rules, auto-confirm when rival is text-only.

CREATE OR REPLACE FUNCTION public.validate_match_scores(
  p_team_a_games INT,
  p_team_b_games INT,
  p_duration_target_games INT
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_team_a_games = p_team_b_games THEN
    RAISE EXCEPTION 'tie_not_allowed';
  END IF;
  IF p_team_a_games < 0 OR p_team_b_games < 0
     OR p_team_a_games > p_duration_target_games
     OR p_team_b_games > p_duration_target_games THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;
  IF GREATEST(p_team_a_games, p_team_b_games) <> p_duration_target_games THEN
    RAISE EXCEPTION 'winner_must_reach_target';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rival_team_has_registered_participant(
  p_match_id UUID,
  p_submitted_by_team TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.team <> p_submitted_by_team
      AND mp.state = 'confirmed'
      AND mp.left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id UUID,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS public.match_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_team TEXT;
  v_status TEXT;
  v_from_status TEXT;
  v_row public.match_results%ROWTYPE;
  v_needs_validation BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF v_match.status NOT IN ('in_progress', 'finished_no_result') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  PERFORM public.validate_match_scores(p_team_a_games, p_team_b_games, v_match.duration_target_games);

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

  IF v_team IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;

  v_needs_validation := public.rival_team_has_registered_participant(p_match_id, v_team);
  v_status := CASE WHEN v_needs_validation THEN 'pending_validation' ELSE 'confirmed' END;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games,
    submitted_by_team, submitted_by_user_id, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games,
    v_team, auth.uid(), v_status
  )
  RETURNING * INTO v_row;

  IF NOT v_needs_validation THEN
    v_from_status := v_match.status;
    PERFORM set_config('app.suppress_match_change_notify', '1', true);
    UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;
    PERFORM set_config('app.suppress_match_change_notify', '0', true);

    INSERT INTO public.match_state_transitions (
      match_id, from_status, to_status, triggered_by, user_id, reason
    ) VALUES (
      p_match_id, v_from_status, 'finished', 'user', auth.uid(),
      'Resultado confirmado (rival solo texto)'
    );

    IF v_match.tournament_id IS NOT NULL THEN
      PERFORM public.advance_tournament_round(p_match_id);
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

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
  IF v_match.status <> 'in_progress' THEN RAISE EXCEPTION 'invalid_match_status'; END IF;

  PERFORM public.validate_match_scores(p_team_a_games, p_team_b_games, v_match.duration_target_games);

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games, submitted_by_team, submitted_by_user_id, status
  ) VALUES (p_match_id, p_team_a_games, p_team_b_games, 'A', auth.uid(), 'confirmed');

  UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;

  INSERT INTO public.match_state_transitions (
    match_id, from_status, to_status, triggered_by, user_id, reason
  ) VALUES (p_match_id, v_match.status, 'finished', 'user', auth.uid(), 'direct result by creator');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_tournament_match_result_as_referee(
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
  v_tournament public.tournaments%ROWTYPE;
  v_from_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.tournament_id IS NULL THEN RAISE EXCEPTION 'not_tournament_match'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  IF v_tournament.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_referee'; END IF;
  IF v_match.status NOT IN ('in_progress', 'planned') THEN RAISE EXCEPTION 'invalid_match_status'; END IF;

  PERFORM public.validate_match_scores(p_team_a_games, p_team_b_games, v_match.duration_target_games);

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games, submitted_by_team, submitted_by_user_id, status
  ) VALUES (p_match_id, p_team_a_games, p_team_b_games, 'A', auth.uid(), 'confirmed');

  v_from_status := v_match.status;
  PERFORM set_config('app.suppress_match_change_notify', '1', true);
  UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;
  PERFORM set_config('app.suppress_match_change_notify', '0', true);

  INSERT INTO public.match_state_transitions (
    match_id, from_status, to_status, triggered_by, user_id, reason
  ) VALUES (p_match_id, v_from_status, 'finished', 'user', auth.uid(), 'referee result');

  PERFORM public.advance_tournament_round(p_match_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_match_result(UUID, INT, INT) TO authenticated;
