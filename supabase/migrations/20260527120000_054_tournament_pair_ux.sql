-- 054: Optional pair names (auto-derived), complete pairs only in bracket, sync names on join.

ALTER TABLE public.tournament_pairs
  ADD COLUMN IF NOT EXISTS name_is_custom BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tournament_pairs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.tournament_pair_slot_label(
  p_user_id UUID,
  p_text TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(p_text), ''),
    (SELECT NULLIF(BTRIM(display_name), '') FROM public.profiles WHERE id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.tournament_pair_derived_name(
  p_player_a_user_id UUID,
  p_player_a_text TEXT,
  p_player_b_user_id UUID,
  p_player_b_text TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_a TEXT;
  v_b TEXT;
BEGIN
  v_a := public.tournament_pair_slot_label(p_player_a_user_id, p_player_a_text);
  v_b := public.tournament_pair_slot_label(p_player_b_user_id, p_player_b_text);

  IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
    RETURN v_a || ' - ' || v_b;
  ELSIF v_a IS NOT NULL THEN
    RETURN v_a;
  ELSIF v_b IS NOT NULL THEN
    RETURN v_b;
  END IF;

  RETURN 'Pareja';
END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_pair_is_complete(
  p_player_a_user_id UUID,
  p_player_a_text TEXT,
  p_player_b_user_id UUID,
  p_player_b_text TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (p_player_a_user_id IS NOT NULL OR NULLIF(BTRIM(p_player_a_text), '') IS NOT NULL)
    AND (p_player_b_user_id IS NOT NULL OR NULLIF(BTRIM(p_player_b_text), '') IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_tournament_pair_name(p_pair_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
  v_derived TEXT;
BEGIN
  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  IF NOT FOUND OR v_pair.name_is_custom THEN
    RETURN;
  END IF;

  v_derived := public.tournament_pair_derived_name(
    v_pair.player_a_user_id,
    v_pair.player_a_text,
    v_pair.player_b_user_id,
    v_pair.player_b_text
  );

  UPDATE public.tournament_pairs
  SET name = v_derived, updated_at = NOW()
  WHERE id = p_pair_id AND name IS DISTINCT FROM v_derived;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_tournament_pair(
  p_tournament_id UUID,
  p_name TEXT,
  p_player_a_user_id UUID DEFAULT NULL,
  p_player_a_text TEXT DEFAULT NULL,
  p_player_b_user_id UUID DEFAULT NULL,
  p_player_b_text TEXT DEFAULT NULL
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_row public.tournament_pairs%ROWTYPE;
  v_custom_name TEXT;
  v_name TEXT;
  v_custom BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF v_tournament.status <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_in_registration';
  END IF;
  IF NOT public.auth_can_read_tournament(p_tournament_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_player_a_user_id IS NOT NULL AND p_player_a_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'cannot_assign_other_user';
  END IF;

  IF p_player_b_user_id IS NOT NULL AND p_player_b_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'cannot_assign_other_user';
  END IF;

  IF p_player_a_user_id IS NOT NULL
     AND public.user_is_in_tournament_pair(p_tournament_id, p_player_a_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  IF p_player_b_user_id IS NOT NULL
     AND public.user_is_in_tournament_pair(p_tournament_id, p_player_b_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  IF p_player_a_user_id IS NOT NULL
     AND p_player_b_user_id IS NOT NULL
     AND p_player_a_user_id = p_player_b_user_id THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  v_custom_name := NULLIF(BTRIM(p_name), '');
  v_custom := v_custom_name IS NOT NULL;
  v_name := COALESCE(
    v_custom_name,
    public.tournament_pair_derived_name(
      p_player_a_user_id,
      NULLIF(BTRIM(p_player_a_text), ''),
      p_player_b_user_id,
      NULLIF(BTRIM(p_player_b_text), '')
    )
  );

  INSERT INTO public.tournament_pairs (
    tournament_id, name, name_is_custom,
    player_a_user_id, player_a_text,
    player_b_user_id, player_b_text,
    created_by_user_id
  ) VALUES (
    p_tournament_id, v_name, v_custom,
    p_player_a_user_id, NULLIF(BTRIM(p_player_a_text), ''),
    p_player_b_user_id, NULLIF(BTRIM(p_player_b_text), ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tournament_pair(
  p_pair_id UUID,
  p_slot TEXT,
  p_as_text TEXT DEFAULT NULL
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pair_not_found'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_pair.tournament_id;
  IF v_tournament.status <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_in_registration';
  END IF;
  IF NOT public.auth_can_read_tournament(v_pair.tournament_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_as_text IS NULL OR NULLIF(BTRIM(p_as_text), '') IS NULL THEN
    IF public.user_is_in_tournament_pair(v_pair.tournament_id, auth.uid(), p_pair_id) THEN
      RAISE EXCEPTION 'already_in_pair';
    END IF;
    IF (p_slot = 'a' AND v_pair.player_b_user_id = auth.uid())
       OR (p_slot = 'b' AND v_pair.player_a_user_id = auth.uid()) THEN
      RAISE EXCEPTION 'already_in_pair';
    END IF;
  END IF;

  IF p_slot = 'a' THEN
    IF v_pair.player_a_user_id IS NOT NULL OR v_pair.player_a_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.tournament_pairs SET player_a_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.tournament_pairs SET player_a_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSIF p_slot = 'b' THEN
    IF v_pair.player_b_user_id IS NOT NULL OR v_pair.player_b_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.tournament_pairs SET player_b_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.tournament_pairs SET player_b_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  PERFORM public.sync_tournament_pair_name(p_pair_id);

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  RETURN v_pair;
END;
$$;

-- Only complete pairs enter the bracket (same body as 036, filtered pair list).
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

  PERFORM public.propagate_tournament_winners(p_tournament_id);

  UPDATE public.tournaments
  SET status = 'in_progress', bracket_generated_at = NOW(), updated_at = NOW()
  WHERE id = p_tournament_id;
END;
$$;

-- Backfill derived names for pairs without a custom label.
UPDATE public.tournament_pairs tp
SET
  name = public.tournament_pair_derived_name(
    tp.player_a_user_id,
    tp.player_a_text,
    tp.player_b_user_id,
    tp.player_b_text
  ),
  name_is_custom = FALSE,
  updated_at = NOW()
WHERE NOT tp.name_is_custom;
