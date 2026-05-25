-- 029: Tournament UX fixes — profile names in pairs, full bracket skeleton, advance updates placeholders.

-- ── Profiles visible to anyone who can read the tournament ────────────────────

CREATE POLICY profiles_select_tournament_peers ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_pairs tp
      WHERE tp.tournament_id IS NOT NULL
        AND public.auth_can_read_tournament(tp.tournament_id)
        AND (
          tp.player_a_user_id = profiles.id
          OR tp.player_b_user_id = profiles.id
        )
    )
  );

-- ── generate_tournament_bracket: first round + empty slots for later rounds ───

CREATE OR REPLACE FUNCTION public.generate_tournament_bracket(p_tournament_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_n_pairs INT;
  v_bracket_size INT;
  v_bye_count INT;
  v_first_round_size INT;
  v_pair_ids UUID[];
  v_playing UUID[];
  v_bye_pairs UUID[];
  v_i INT;
  v_match_id UUID;
  v_pos INT;
  v_round_label TEXT;
  v_round_size INT;
  v_round_title TEXT;
  v_num_matches INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF v_tournament.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF v_tournament.status <> 'registration' THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_pair_ids
  FROM public.tournament_pairs
  WHERE tournament_id = p_tournament_id AND NOT is_eliminated;

  v_n_pairs := COALESCE(array_length(v_pair_ids, 1), 0);
  IF v_n_pairs < 2 THEN RAISE EXCEPTION 'need_at_least_two_pairs'; END IF;

  v_bracket_size := public.next_pow2(v_n_pairs);
  v_bye_count := v_bracket_size - v_n_pairs;
  v_first_round_size := v_bracket_size;

  v_bye_pairs := v_pair_ids[1:v_bye_count];
  v_playing := v_pair_ids[v_bye_count + 1:v_n_pairs];

  v_round_label := v_tournament.title || ' — Ronda';

  FOR v_i IN 1..COALESCE(array_length(v_bye_pairs, 1), 0) LOOP
    v_pos := v_bracket_size / 2 - v_bye_count + v_i - 1;
    IF v_pos < 0 THEN v_pos := v_i - 1; END IF;

    INSERT INTO public.matches (
      title, start_at, city, place_defined, place_text,
      duration_target_games, visibility, location_privacy,
      creator_id, status,
      tournament_id, tournament_round_size, tournament_bracket_position,
      tournament_pair_a_id, tournament_pair_b_id, tournament_winner_pair_id,
      tournament_is_bye,
      team_a_name, team_b_name
    ) VALUES (
      v_round_label || ' (bye)',
      NOW(), v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
      v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
      v_tournament.creator_id, 'finished',
      p_tournament_id, v_first_round_size, v_pos,
      v_bye_pairs[v_i], NULL, v_bye_pairs[v_i],
      TRUE,
      (SELECT name FROM public.tournament_pairs WHERE id = v_bye_pairs[v_i]),
      'Bye'
    )
    RETURNING id INTO v_match_id;

    PERFORM public.populate_match_roster_from_pair(v_match_id, v_bye_pairs[v_i], 'A');
  END LOOP;

  v_i := 1;
  v_pos := 0;
  WHILE v_i <= COALESCE(array_length(v_playing, 1), 0) LOOP
    WHILE EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.tournament_id = p_tournament_id
        AND m.tournament_round_size = v_first_round_size
        AND m.tournament_bracket_position = v_pos
    ) LOOP
      v_pos := v_pos + 1;
    END LOOP;

    IF v_i + 1 <= COALESCE(array_length(v_playing, 1), 0) THEN
      INSERT INTO public.matches (
        title, start_at, city, place_defined, place_text,
        duration_target_games, visibility, location_privacy,
        creator_id, status,
        tournament_id, tournament_round_size, tournament_bracket_position,
        tournament_pair_a_id, tournament_pair_b_id,
        team_a_name, team_b_name
      ) VALUES (
        v_round_label,
        NOW(), v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
        v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
        v_tournament.creator_id, 'in_progress',
        p_tournament_id, v_first_round_size, v_pos,
        v_playing[v_i], v_playing[v_i + 1],
        (SELECT name FROM public.tournament_pairs WHERE id = v_playing[v_i]),
        (SELECT name FROM public.tournament_pairs WHERE id = v_playing[v_i + 1])
      )
      RETURNING id INTO v_match_id;

      PERFORM public.populate_match_roster_from_pair(v_match_id, v_playing[v_i], 'A');
      PERFORM public.populate_match_roster_from_pair(v_match_id, v_playing[v_i + 1], 'B');
      v_i := v_i + 2;
    ELSE
      INSERT INTO public.matches (
        title, start_at, city, place_defined, place_text,
        duration_target_games, visibility, location_privacy,
        creator_id, status,
        tournament_id, tournament_round_size, tournament_bracket_position,
        tournament_pair_a_id, tournament_winner_pair_id, tournament_is_bye,
        team_a_name, team_b_name
      ) VALUES (
        v_round_label || ' (bye)',
        NOW(), v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
        v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
        v_tournament.creator_id, 'finished',
        p_tournament_id, v_first_round_size, v_pos,
        v_playing[v_i], v_playing[v_i], TRUE,
        (SELECT name FROM public.tournament_pairs WHERE id = v_playing[v_i]),
        'Bye'
      )
      RETURNING id INTO v_match_id;

      PERFORM public.populate_match_roster_from_pair(v_match_id, v_playing[v_i], 'A');
      v_i := v_i + 1;
    END IF;

    v_pos := v_pos + 1;
  END LOOP;

  -- Placeholder slots for later rounds (visible in bracket before they are played)
  v_round_size := v_first_round_size / 2;
  WHILE v_round_size >= 2 LOOP
    v_round_title := v_tournament.title || ' — ' || CASE v_round_size
      WHEN 2 THEN 'Final'
      WHEN 4 THEN 'Semifinal'
      WHEN 8 THEN 'Cuartos'
      WHEN 16 THEN 'Octavos'
      ELSE 'Ronda'
    END;
    v_num_matches := v_round_size / 2;

    FOR v_pos IN 0..(v_num_matches - 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.tournament_id = p_tournament_id
          AND m.tournament_round_size = v_round_size
          AND m.tournament_bracket_position = v_pos
      ) THEN
        INSERT INTO public.matches (
          title, start_at, city, place_defined, place_text,
          duration_target_games, visibility, location_privacy,
          creator_id, status,
          tournament_id, tournament_round_size, tournament_bracket_position,
          team_a_name, team_b_name
        ) VALUES (
          v_round_title,
          v_tournament.start_at, v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
          v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
          v_tournament.creator_id, 'planned',
          p_tournament_id, v_round_size, v_pos,
          'Por determinar', 'Por determinar'
        );
      END IF;
    END LOOP;

    v_round_size := v_round_size / 2;
  END LOOP;

  UPDATE public.tournaments
  SET status = 'in_progress', bracket_generated_at = NOW(), updated_at = NOW()
  WHERE id = p_tournament_id;
END;
$$;

-- ── advance_tournament_round: fill pre-created placeholder match ──────────────

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
  IF v_match.tournament_winner_pair_id IS NOT NULL THEN RETURN; END IF;
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
