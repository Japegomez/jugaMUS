-- 039: Block direct INSERT into match_results; force validated RPC paths.

DROP POLICY IF EXISTS match_results_insert ON public.match_results;

-- Safety net: validate scores if INSERT bypasses RLS (e.g. service role misuse).
CREATE OR REPLACE FUNCTION public.validate_match_result_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  PERFORM public.validate_match_scores(
    NEW.team_a_games,
    NEW.team_b_games,
    v_match.duration_target_games
  );

  IF NEW.status NOT IN ('pending_validation', 'confirmed', 'disputed', 'void') THEN
    RAISE EXCEPTION 'invalid_result_status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_match_result_on_insert ON public.match_results;
CREATE TRIGGER trg_validate_match_result_on_insert
  BEFORE INSERT ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_result_on_insert();
