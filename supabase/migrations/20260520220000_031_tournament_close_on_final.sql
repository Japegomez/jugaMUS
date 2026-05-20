-- 031: Auto-close tournament when the final match finishes (result) or is cancelled.

CREATE OR REPLACE FUNCTION public.finalize_tournament_if_final_match(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.tournament_id IS NULL THEN RETURN; END IF;
  IF COALESCE(v_match.tournament_round_size, 999) > 2 THEN RETURN; END IF;
  IF COALESCE(v_match.tournament_is_bye, FALSE) THEN RETURN; END IF;
  IF v_match.status NOT IN ('finished', 'cancelled') THEN RETURN; END IF;

  IF v_match.status = 'finished' THEN
    PERFORM public.advance_tournament_round(p_match_id);
    RETURN;
  END IF;

  UPDATE public.tournaments
  SET status = 'finished', updated_at = NOW()
  WHERE id = v_match.tournament_id AND status = 'in_progress';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_finalize_tournament_on_match_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tournament_id IS NOT NULL
     AND NEW.status IN ('finished', 'cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    PERFORM public.finalize_tournament_if_final_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalize_tournament_on_match_end ON public.matches;
CREATE TRIGGER trg_finalize_tournament_on_match_end
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_finalize_tournament_on_match_end();

CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_result public.match_results%ROWTYPE;
  v_winner_pair_id UUID;
  v_loser_pair_id UUID;
  v_sibling_pos INT;
  v_sibling public.matches%ROWTYPE;
  v_next_round_size INT;
  v_next_pos INT;
  v_winner_a UUID;
  v_winner_b UUID;
  v_next_match public.matches%ROWTYPE;
  v_lower_pos INT;
  v_higher_pos INT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.tournament_id IS NULL THEN RETURN; END IF;

  IF v_match.tournament_winner_pair_id IS NOT NULL THEN
    IF COALESCE(v_match.tournament_round_size, 999) <= 2 THEN
      UPDATE public.tournaments
      SET status = 'finished', updated_at = NOW()
      WHERE id = v_match.tournament_id AND status = 'in_progress';
    END IF;
    RETURN;
  END IF;

  IF v_match.tournament_is_bye THEN RETURN; END IF;

  SELECT * INTO v_result
  FROM public.match_results
  WHERE match_id = p_match_id AND status = 'confirmed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_result.team_a_games > v_result.team_b_games THEN
    v_winner_pair_id := v_match.tournament_pair_a_id;
    v_loser_pair_id := v_match.tournament_pair_b_id;
  ELSIF v_result.team_b_games > v_result.team_a_games THEN
    v_winner_pair_id := v_match.tournament_pair_b_id;
    v_loser_pair_id := v_match.tournament_pair_a_id;
  ELSE
    RETURN;
  END IF;

  UPDATE public.matches
  SET tournament_winner_pair_id = v_winner_pair_id, updated_at = NOW()
  WHERE id = p_match_id;

  IF v_loser_pair_id IS NOT NULL THEN
    UPDATE public.tournament_pairs SET is_eliminated = TRUE WHERE id = v_loser_pair_id;
  END IF;

  IF v_match.tournament_round_size <= 2 THEN
    UPDATE public.tournaments
    SET status = 'finished', updated_at = NOW()
    WHERE id = v_match.tournament_id;
    RETURN;
  END IF;

  v_sibling_pos := CASE
    WHEN v_match.tournament_bracket_position % 2 = 0
      THEN v_match.tournament_bracket_position + 1
    ELSE v_match.tournament_bracket_position - 1
  END;

  SELECT * INTO v_sibling
  FROM public.matches
  WHERE tournament_id = v_match.tournament_id
    AND tournament_round_size = v_match.tournament_round_size
    AND tournament_bracket_position = v_sibling_pos;

  IF NOT FOUND OR v_sibling.tournament_winner_pair_id IS NULL THEN
    RETURN;
  END IF;

  v_next_round_size := v_match.tournament_round_size / 2;
  v_next_pos := v_match.tournament_bracket_position / 2;
  v_lower_pos := v_next_pos * 2;
  v_higher_pos := v_next_pos * 2 + 1;

  SELECT tournament_winner_pair_id INTO v_winner_a
  FROM public.matches
  WHERE tournament_id = v_match.tournament_id
    AND tournament_round_size = v_match.tournament_round_size
    AND tournament_bracket_position = v_lower_pos;

  SELECT tournament_winner_pair_id INTO v_winner_b
  FROM public.matches
  WHERE tournament_id = v_match.tournament_id
    AND tournament_round_size = v_match.tournament_round_size
    AND tournament_bracket_position = v_higher_pos;

  IF v_winner_a IS NULL OR v_winner_b IS NULL THEN RETURN; END IF;

  SELECT * INTO v_next_match
  FROM public.matches
  WHERE tournament_id = v_match.tournament_id
    AND tournament_round_size = v_next_round_size
    AND tournament_bracket_position = v_next_pos
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_next_match.tournament_pair_a_id IS NOT NULL
     AND v_next_match.tournament_pair_b_id IS NOT NULL
     AND v_next_match.status <> 'planned' THEN
    RETURN;
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  UPDATE public.matches
  SET
    title = v_tournament.title || ' — ' || CASE v_next_round_size
      WHEN 2 THEN 'Final'
      WHEN 4 THEN 'Semifinal'
      WHEN 8 THEN 'Cuartos'
      WHEN 16 THEN 'Octavos'
      ELSE 'Ronda'
    END,
    start_at = NOW(),
    status = 'in_progress',
    tournament_pair_a_id = v_winner_a,
    tournament_pair_b_id = v_winner_b,
    team_a_name = (SELECT name FROM public.tournament_pairs WHERE id = v_winner_a),
    team_b_name = (SELECT name FROM public.tournament_pairs WHERE id = v_winner_b),
    updated_at = NOW()
  WHERE id = v_next_match.id;

  DELETE FROM public.match_participants WHERE match_id = v_next_match.id;

  PERFORM public.populate_match_roster_from_pair(v_next_match.id, v_winner_a, 'A');
  PERFORM public.populate_match_roster_from_pair(v_next_match.id, v_winner_b, 'B');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_tournament_if_final_match(UUID) TO authenticated;

-- Repair tournaments whose final already ended but status was not updated.
UPDATE public.tournaments t
SET status = 'finished', updated_at = NOW()
WHERE t.status = 'in_progress'
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = t.id
      AND COALESCE(m.tournament_round_size, 999) <= 2
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND (
        m.status = 'cancelled'
        OR m.tournament_winner_pair_id IS NOT NULL
        OR (
          m.status = 'finished'
          AND EXISTS (
            SELECT 1 FROM public.match_results mr
            WHERE mr.match_id = m.id AND mr.status = 'confirmed'
          )
        )
      )
  );
