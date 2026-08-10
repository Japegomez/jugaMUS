-- 089: Finish round-robin leagues when all matches are done.
--   Trigger maybe_finish_league after match status becomes terminal (not on result
--   confirmation alone, which runs before the match is marked finished).

CREATE OR REPLACE FUNCTION public.on_league_match_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.league_id IS NOT NULL
     AND NEW.status IN ('finished', 'finished_no_result', 'cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    PERFORM public.maybe_finish_league(NEW.league_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS league_match_status_changed ON public.matches;
CREATE TRIGGER league_match_status_changed
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.on_league_match_status_changed();

-- Require at least one league match before auto-finishing round-robin.
CREATE OR REPLACE FUNCTION public.maybe_finish_league(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_pending INT;
  v_has_matches BOOLEAN;
BEGIN
  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND OR v_league.status <> 'in_progress' THEN RETURN; END IF;

  IF v_league.format = 'open_elo' THEN
    IF v_league.end_at IS NOT NULL AND NOW() > v_league.end_at THEN
      UPDATE public.league_challenges
      SET status = 'expired', responded_at = COALESCE(responded_at, NOW())
      WHERE league_id = p_league_id AND status = 'pending';

      UPDATE public.leagues SET status = 'finished' WHERE id = p_league_id;
    END IF;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matches WHERE league_id = p_league_id
  ) INTO v_has_matches;

  IF NOT v_has_matches THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_pending
  FROM public.matches
  WHERE league_id = p_league_id
    AND status NOT IN ('finished', 'finished_no_result', 'cancelled');

  IF v_pending = 0 THEN
    UPDATE public.leagues SET status = 'finished', updated_at = NOW() WHERE id = p_league_id;
  END IF;
END;
$$;
