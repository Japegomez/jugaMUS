-- 064: Optional 3rd/4th place match for tournaments (semifinal losers).

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS include_third_place BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_is_third_place BOOLEAN NOT NULL DEFAULT FALSE;

-- ── create_tournament: include_third_place flag ───────────────────────────────

CREATE OR REPLACE FUNCTION public.create_tournament(
  p_title TEXT,
  p_start_at TIMESTAMPTZ,
  p_city TEXT,
  p_duration_target_games INT,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_place_defined BOOLEAN DEFAULT TRUE,
  p_place_text TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_location_privacy TEXT DEFAULT 'participants_only',
  p_creator_joins_as_player BOOLEAN DEFAULT FALSE,
  p_include_third_place BOOLEAN DEFAULT FALSE
)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournaments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NULLIF(BTRIM(p_city), '') IS NULL THEN
    RAISE EXCEPTION 'city_required';
  END IF;

  INSERT INTO public.tournaments (
    title,
    description,
    notes,
    start_at,
    city,
    place_defined,
    place_text,
    duration_target_games,
    visibility,
    location_privacy,
    creator_id,
    creator_joins_as_player,
    include_third_place,
    status
  ) VALUES (
    BTRIM(p_title),
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_notes), ''),
    p_start_at,
    BTRIM(p_city),
    COALESCE(p_place_defined, TRUE),
    CASE WHEN COALESCE(p_place_defined, TRUE) THEN NULLIF(BTRIM(p_place_text), '') ELSE NULL END,
    p_duration_target_games,
    COALESCE(p_visibility, 'public'),
    COALESCE(p_location_privacy, 'participants_only'),
    auth.uid(),
    COALESCE(p_creator_joins_as_player, FALSE),
    COALESCE(p_include_third_place, FALSE),
    'registration'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) TO authenticated;

-- ── Assign semifinal loser to 3rd/4th place match ────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_semifinal_loser_to_third_place(
  p_tournament_id UUID,
  p_loser_pair_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_third public.matches%ROWTYPE;
BEGIN
  IF p_loser_pair_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_third
  FROM public.matches
  WHERE tournament_id = p_tournament_id
    AND COALESCE(tournament_is_third_place, FALSE) = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_third.tournament_pair_a_id IS NULL THEN
    UPDATE public.matches
    SET
      tournament_pair_a_id = p_loser_pair_id,
      team_a_name = (SELECT name FROM public.tournament_pairs WHERE id = p_loser_pair_id),
      updated_at = NOW()
    WHERE id = v_third.id;

    DELETE FROM public.match_participants
    WHERE match_id = v_third.id AND team = 'A';

    PERFORM public.populate_match_roster_from_pair(v_third.id, p_loser_pair_id, 'A');
  ELSIF v_third.tournament_pair_b_id IS NULL
        AND v_third.tournament_pair_a_id IS DISTINCT FROM p_loser_pair_id THEN
    UPDATE public.matches
    SET
      tournament_pair_b_id = p_loser_pair_id,
      team_b_name = (SELECT name FROM public.tournament_pairs WHERE id = p_loser_pair_id),
      updated_at = NOW()
    WHERE id = v_third.id;

    DELETE FROM public.match_participants
    WHERE match_id = v_third.id AND team = 'B';

    PERFORM public.populate_match_roster_from_pair(v_third.id, p_loser_pair_id, 'B');
  ELSE
    RETURN;
  END IF;

  SELECT * INTO v_third FROM public.matches WHERE id = v_third.id FOR UPDATE;

  IF v_third.tournament_pair_a_id IS NOT NULL
     AND v_third.tournament_pair_b_id IS NOT NULL
     AND v_third.status = 'planned' THEN
    UPDATE public.matches
    SET status = 'in_progress', start_at = NOW(), updated_at = NOW()
    WHERE id = v_third.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_semifinal_loser_to_third_place(UUID, UUID) FROM PUBLIC;

-- ── Finish tournament when final (and optional 3rd place) are done ────────────

CREATE OR REPLACE FUNCTION public.maybe_finish_tournament(p_tournament_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_final public.matches%ROWTYPE;
  v_third public.matches%ROWTYPE;
BEGIN
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND OR v_tournament.status <> 'in_progress' THEN RETURN; END IF;

  SELECT * INTO v_final
  FROM public.matches
  WHERE tournament_id = p_tournament_id
    AND tournament_round_size = 2
    AND COALESCE(tournament_is_third_place, FALSE) = FALSE
    AND COALESCE(tournament_is_bye, FALSE) = FALSE
  ORDER BY tournament_bracket_position ASC
  LIMIT 1;

  IF NOT FOUND OR v_final.status NOT IN ('finished', 'cancelled', 'finished_no_result') THEN
    RETURN;
  END IF;

  IF v_tournament.include_third_place THEN
    SELECT * INTO v_third
    FROM public.matches
    WHERE tournament_id = p_tournament_id
      AND COALESCE(tournament_is_third_place, FALSE) = TRUE
    LIMIT 1;

    IF FOUND AND v_third.status NOT IN ('finished', 'cancelled', 'finished_no_result') THEN
      RETURN;
    END IF;
  END IF;

  UPDATE public.tournaments
  SET status = 'finished', updated_at = NOW()
  WHERE id = p_tournament_id AND status = 'in_progress';
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_finish_tournament(UUID) FROM PUBLIC;

-- ── advance_tournament_round: semifinal losers → 3rd place ───────────────────

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

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

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
      IF COALESCE(v_match.tournament_is_third_place, FALSE) THEN
        UPDATE public.tournament_pairs SET is_eliminated = TRUE WHERE id = v_loser_pair_id;
      ELSIF v_tournament.include_third_place AND v_match.tournament_round_size = 4 THEN
        PERFORM public.assign_semifinal_loser_to_third_place(v_match.tournament_id, v_loser_pair_id);
      ELSE
        UPDATE public.tournament_pairs SET is_eliminated = TRUE WHERE id = v_loser_pair_id;
      END IF;
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  END IF;

  IF v_match.tournament_winner_pair_id IS NULL THEN RETURN; END IF;

  IF COALESCE(v_match.tournament_is_third_place, FALSE) OR v_match.tournament_round_size <= 2 THEN
    PERFORM public.maybe_finish_tournament(v_match.tournament_id);
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
    AND COALESCE(tournament_is_third_place, FALSE) = FALSE
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

-- ── generate_tournament_bracket: create 3rd/4th place slot ───────────────────

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

  SELECT ARRAY_AGG(tp.id ORDER BY random()) INTO v_pair_ids
  FROM public.tournament_pairs tp
  WHERE tp.tournament_id = p_tournament_id
    AND NOT tp.is_eliminated
    AND public.tournament_pair_is_complete(
      tp.player_a_user_id,
      tp.player_a_text,
      tp.player_b_user_id,
      tp.player_b_text
    );

  v_n_pairs := COALESCE(array_length(v_pair_ids, 1), 0);
  IF v_n_pairs < 2 THEN RAISE EXCEPTION 'need_at_least_two_complete_pairs'; END IF;

  v_bracket_size := public.next_pow2(v_n_pairs);
  v_bye_count := v_bracket_size - v_n_pairs;
  v_first_round_size := v_bracket_size;

  v_bye_pairs := v_pair_ids[1:v_bye_count];
  v_playing := v_pair_ids[v_bye_count + 1:v_n_pairs];

  v_round_label := public.tournament_match_title(v_tournament.title, v_first_round_size, FALSE);

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
      public.tournament_match_title(v_tournament.title, v_first_round_size, TRUE),
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
        AND COALESCE(m.tournament_is_third_place, FALSE) = FALSE
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
        public.tournament_match_title(v_tournament.title, v_first_round_size, TRUE),
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

  v_round_size := v_first_round_size / 2;
  WHILE v_round_size >= 2 LOOP
    v_round_title := public.tournament_match_title(v_tournament.title, v_round_size, FALSE);
    v_num_matches := v_round_size / 2;

    FOR v_pos IN 0..(v_num_matches - 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.tournament_id = p_tournament_id
          AND m.tournament_round_size = v_round_size
          AND m.tournament_bracket_position = v_pos
          AND COALESCE(m.tournament_is_third_place, FALSE) = FALSE
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

  IF v_tournament.include_third_place AND v_bracket_size >= 4 THEN
    INSERT INTO public.matches (
      title, start_at, city, place_defined, place_text,
      duration_target_games, visibility, location_privacy,
      creator_id, status,
      tournament_id, tournament_round_size, tournament_bracket_position,
      tournament_is_third_place,
      team_a_name, team_b_name
    ) VALUES (
      v_tournament.title || ' — 3º y 4º puesto',
      v_tournament.start_at, v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
      v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
      v_tournament.creator_id, 'planned',
      p_tournament_id, 2, -1,
      TRUE,
      'Por determinar', 'Por determinar'
    );
  END IF;

  PERFORM public.propagate_tournament_winners(p_tournament_id);

  UPDATE public.tournaments
  SET status = 'in_progress', bracket_generated_at = NOW(), updated_at = NOW()
  WHERE id = p_tournament_id;
END;
$$;

-- ── list_tournament_bracket: expose is_third_place ─────────────────────────────

DROP FUNCTION IF EXISTS public.list_tournament_bracket(UUID);

CREATE OR REPLACE FUNCTION public.list_tournament_bracket(p_tournament_id UUID)
RETURNS TABLE (
  match_id UUID,
  round_size INT,
  bracket_position INT,
  pair_a_id UUID,
  pair_a_name TEXT,
  pair_b_id UUID,
  pair_b_name TEXT,
  winner_pair_id UUID,
  match_status TEXT,
  is_bye BOOLEAN,
  is_third_place BOOLEAN,
  team_a_games INT,
  team_b_games INT,
  start_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id AS match_id,
    m.tournament_round_size AS round_size,
    m.tournament_bracket_position AS bracket_position,
    m.tournament_pair_a_id AS pair_a_id,
    pa.name AS pair_a_name,
    m.tournament_pair_b_id AS pair_b_id,
    pb.name AS pair_b_name,
    m.tournament_winner_pair_id AS winner_pair_id,
    m.status AS match_status,
    m.tournament_is_bye AS is_bye,
    COALESCE(m.tournament_is_third_place, FALSE) AS is_third_place,
    mr.team_a_games,
    mr.team_b_games,
    m.start_at
  FROM public.matches m
  LEFT JOIN public.tournament_pairs pa ON pa.id = m.tournament_pair_a_id
  LEFT JOIN public.tournament_pairs pb ON pb.id = m.tournament_pair_b_id
  LEFT JOIN LATERAL (
    SELECT r.team_a_games, r.team_b_games
    FROM public.match_results r
    WHERE r.match_id = m.id AND r.status = 'confirmed'
    ORDER BY r.created_at DESC
    LIMIT 1
  ) mr ON TRUE
  WHERE m.tournament_id = p_tournament_id
    AND public.auth_can_read_tournament(p_tournament_id)
  ORDER BY
    COALESCE(m.tournament_is_third_place, FALSE) ASC,
    m.tournament_round_size DESC,
    m.tournament_bracket_position ASC;
$$;

REVOKE ALL ON FUNCTION public.list_tournament_bracket(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_tournament_bracket(UUID) TO authenticated;
