-- 034: Advance bracket winners into the next round slot-by-slot (partial fill).

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
  v_next_round_size INT;
  v_next_pos INT;
  v_next_match public.matches%ROWTYPE;
  v_lower_pos INT;
  v_higher_pos INT;
  v_round_title TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.tournament_id IS NULL THEN RETURN; END IF;

  IF v_match.tournament_winner_pair_id IS NULL THEN
    IF COALESCE(v_match.tournament_is_bye, FALSE) THEN RETURN; END IF;

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

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  END IF;

  IF v_match.tournament_winner_pair_id IS NULL THEN RETURN; END IF;

  IF v_match.tournament_round_size <= 2 THEN
    UPDATE public.tournaments
    SET status = 'finished', updated_at = NOW()
    WHERE id = v_match.tournament_id AND status = 'in_progress';
    RETURN;
  END IF;

  v_next_round_size := v_match.tournament_round_size / 2;
  v_next_pos := v_match.tournament_bracket_position / 2;
  v_lower_pos := v_next_pos * 2;
  v_higher_pos := v_next_pos * 2 + 1;

  SELECT * INTO v_next_match
  FROM public.matches
  WHERE tournament_id = v_match.tournament_id
    AND tournament_round_size = v_next_round_size
    AND tournament_bracket_position = v_next_pos
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_next_match.status NOT IN ('planned', 'in_progress') THEN RETURN; END IF;

  IF v_match.tournament_bracket_position = v_lower_pos THEN
    IF v_next_match.tournament_pair_a_id IS DISTINCT FROM v_match.tournament_winner_pair_id THEN
      UPDATE public.matches
      SET
        tournament_pair_a_id = v_match.tournament_winner_pair_id,
        team_a_name = (SELECT name FROM public.tournament_pairs WHERE id = v_match.tournament_winner_pair_id),
        updated_at = NOW()
      WHERE id = v_next_match.id;

      DELETE FROM public.match_participants
      WHERE match_id = v_next_match.id AND team = 'A';

      PERFORM public.populate_match_roster_from_pair(
        v_next_match.id, v_match.tournament_winner_pair_id, 'A'
      );
    END IF;
  ELSIF v_match.tournament_bracket_position = v_higher_pos THEN
    IF v_next_match.tournament_pair_b_id IS DISTINCT FROM v_match.tournament_winner_pair_id THEN
      UPDATE public.matches
      SET
        tournament_pair_b_id = v_match.tournament_winner_pair_id,
        team_b_name = (SELECT name FROM public.tournament_pairs WHERE id = v_match.tournament_winner_pair_id),
        updated_at = NOW()
      WHERE id = v_next_match.id;

      DELETE FROM public.match_participants
      WHERE match_id = v_next_match.id AND team = 'B';

      PERFORM public.populate_match_roster_from_pair(
        v_next_match.id, v_match.tournament_winner_pair_id, 'B'
      );
    END IF;
  ELSE
    RETURN;
  END IF;

  SELECT * INTO v_next_match
  FROM public.matches
  WHERE id = v_next_match.id
  FOR UPDATE;

  IF v_next_match.tournament_pair_a_id IS NOT NULL
     AND v_next_match.tournament_pair_b_id IS NOT NULL
     AND v_next_match.status = 'planned' THEN
    SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

    v_round_title := v_tournament.title || ' — ' || CASE v_next_round_size
      WHEN 2 THEN 'Final'
      WHEN 4 THEN 'Semifinal'
      WHEN 8 THEN 'Cuartos'
      WHEN 16 THEN 'Octavos'
      ELSE 'Ronda'
    END;

    UPDATE public.matches
    SET
      title = v_round_title,
      start_at = NOW(),
      status = 'in_progress',
      updated_at = NOW()
    WHERE id = v_next_match.id;
  END IF;
END;
$$;

DO $$
DECLARE
  v_tid UUID;
BEGIN
  FOR v_tid IN SELECT id FROM public.tournaments WHERE bracket_generated_at IS NOT NULL
  LOOP
    PERFORM public.propagate_tournament_winners(v_tid);
  END LOOP;
END;
$$;
