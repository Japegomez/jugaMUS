-- Migration 026: Tournaments, pairs, bracket matches, RPCs and advancement triggers.

-- ── tournaments ───────────────────────────────────────────────────────────────

CREATE TABLE public.tournaments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  notes                 TEXT,
  start_at              TIMESTAMPTZ NOT NULL,
  city                  TEXT NOT NULL,
  place_text            TEXT,
  place_defined         BOOLEAN NOT NULL DEFAULT TRUE,
  location_privacy      TEXT NOT NULL DEFAULT 'participants_only'
                          CHECK (location_privacy IN ('public_city_only', 'participants_only')),
  duration_target_games INT NOT NULL CHECK (duration_target_games BETWEEN 1 AND 6),
  visibility            TEXT NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'link')),
  creator_id            UUID NOT NULL REFERENCES public.profiles(id),
  creator_joins_as_player BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'registration'
                          CHECK (status IN ('registration', 'in_progress', 'finished', 'cancelled')),
  bracket_generated_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_tournaments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tournaments_updated_at();

CREATE INDEX idx_tournaments_search ON public.tournaments (city, start_at, status);
CREATE INDEX idx_tournaments_creator ON public.tournaments (creator_id, created_at DESC);

-- ── tournament_pairs ──────────────────────────────────────────────────────────

CREATE TABLE public.tournament_pairs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id      UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  player_a_user_id   UUID REFERENCES public.profiles(id),
  player_a_text      TEXT,
  player_b_user_id   UUID REFERENCES public.profiles(id),
  player_b_text      TEXT,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  is_eliminated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tournament_pairs_slot_a_xor CHECK (
    (player_a_user_id IS NULL AND player_a_text IS NULL)
    OR (player_a_user_id IS NOT NULL AND player_a_text IS NULL)
    OR (player_a_user_id IS NULL AND player_a_text IS NOT NULL)
  ),
  CONSTRAINT tournament_pairs_slot_b_xor CHECK (
    (player_b_user_id IS NULL AND player_b_text IS NULL)
    OR (player_b_user_id IS NOT NULL AND player_b_text IS NULL)
    OR (player_b_user_id IS NULL AND player_b_text IS NOT NULL)
  ),
  CONSTRAINT tournament_pairs_at_least_one_player CHECK (
    player_a_user_id IS NOT NULL OR player_a_text IS NOT NULL
    OR player_b_user_id IS NOT NULL OR player_b_text IS NOT NULL
  )
);

CREATE INDEX idx_tournament_pairs_tournament ON public.tournament_pairs (tournament_id);

-- ── matches: tournament bracket columns ─────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tournament_round_size INT,
  ADD COLUMN IF NOT EXISTS tournament_bracket_position INT,
  ADD COLUMN IF NOT EXISTS tournament_pair_a_id UUID REFERENCES public.tournament_pairs(id),
  ADD COLUMN IF NOT EXISTS tournament_pair_b_id UUID REFERENCES public.tournament_pairs(id),
  ADD COLUMN IF NOT EXISTS tournament_winner_pair_id UUID REFERENCES public.tournament_pairs(id),
  ADD COLUMN IF NOT EXISTS tournament_is_bye BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX idx_matches_tournament_bracket_slot
  ON public.matches (tournament_id, tournament_round_size, tournament_bracket_position)
  WHERE tournament_id IS NOT NULL;

CREATE INDEX idx_matches_tournament ON public.matches (tournament_id);

-- ── helpers ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_can_read_tournament(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND (
        t.visibility = 'public'
        OR t.visibility = 'link'
        OR t.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.tournament_pairs tp
          WHERE tp.tournament_id = t.id
            AND (
              tp.player_a_user_id = auth.uid()
              OR tp.player_b_user_id = auth.uid()
              OR tp.created_by_user_id = auth.uid()
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.next_pow2(n INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v INT := 2;
BEGIN
  IF n <= 1 THEN RETURN 2; END IF;
  WHILE v < n LOOP
    v := v * 2;
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_match_roster_from_pair(
  p_match_id UUID,
  p_pair_id UUID,
  p_team TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
BEGIN
  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_team = 'A' THEN
    UPDATE public.matches
    SET
      team_a_name = v_pair.name,
      team_a_player_1 = v_pair.player_a_text,
      team_a_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  ELSE
    UPDATE public.matches
    SET
      team_b_name = v_pair.name,
      team_b_player_1 = v_pair.player_a_text,
      team_b_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  END IF;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tournaments_select ON public.tournaments
  FOR SELECT TO authenticated
  USING (public.auth_can_read_tournament(id));

CREATE POLICY tournaments_insert ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY tournaments_update ON public.tournaments
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY tournament_pairs_select ON public.tournament_pairs
  FOR SELECT TO authenticated
  USING (public.auth_can_read_tournament(tournament_id));

CREATE POLICY tournament_pairs_insert ON public.tournament_pairs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_read_tournament(tournament_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.status = 'registration'
    )
  );

CREATE POLICY tournament_pairs_update ON public.tournament_pairs
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_pairs.tournament_id AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY tournament_pairs_delete ON public.tournament_pairs
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_pairs.tournament_id AND t.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR public.auth_is_confirmed_in_match(id)
    OR visibility = 'link'
    OR (
      tournament_id IS NOT NULL
      AND public.auth_can_read_tournament(tournament_id)
    )
  );

-- ── add_tournament_pair ───────────────────────────────────────────────────────

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

  IF NULLIF(BTRIM(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'pair_name_required';
  END IF;

  INSERT INTO public.tournament_pairs (
    tournament_id, name,
    player_a_user_id, player_a_text,
    player_b_user_id, player_b_text,
    created_by_user_id
  ) VALUES (
    p_tournament_id, BTRIM(p_name),
    p_player_a_user_id, NULLIF(BTRIM(p_player_a_text), ''),
    p_player_b_user_id, NULLIF(BTRIM(p_player_b_text), ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── join_tournament_pair ──────────────────────────────────────────────────────

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

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  RETURN v_pair;
END;
$$;

-- ── generate_tournament_bracket ───────────────────────────────────────────────

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

  -- Bye matches (one per bye pair, each in its own bracket half)
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

  -- Playing matches: pair consecutive playing pairs
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
      -- Odd leftover: treat as bye in last slot
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

  UPDATE public.tournaments
  SET status = 'in_progress', bracket_generated_at = NOW(), updated_at = NOW()
  WHERE id = p_tournament_id;
END;
$$;

-- ── advance_tournament_round ──────────────────────────────────────────────────

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
  v_new_match_id UUID;
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

  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE tournament_id = v_match.tournament_id
      AND tournament_round_size = v_next_round_size
      AND tournament_bracket_position = v_next_pos
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  INSERT INTO public.matches (
    title, start_at, city, place_defined, place_text,
    duration_target_games, visibility, location_privacy,
    creator_id, status,
    tournament_id, tournament_round_size, tournament_bracket_position,
    tournament_pair_a_id, tournament_pair_b_id,
    team_a_name, team_b_name
  ) VALUES (
    v_tournament.title || ' — ' || CASE v_next_round_size
      WHEN 2 THEN 'Final'
      WHEN 4 THEN 'Semifinal'
      WHEN 8 THEN 'Cuartos'
      WHEN 16 THEN 'Octavos'
      ELSE 'Ronda'
    END,
    NOW(), v_tournament.city, v_tournament.place_defined, v_tournament.place_text,
    v_tournament.duration_target_games, v_tournament.visibility, v_tournament.location_privacy,
    v_tournament.creator_id, 'in_progress',
    v_match.tournament_id, v_next_round_size, v_next_pos,
    v_winner_a, v_winner_b,
    (SELECT name FROM public.tournament_pairs WHERE id = v_winner_a),
    (SELECT name FROM public.tournament_pairs WHERE id = v_winner_b)
  )
  RETURNING id INTO v_new_match_id;

  PERFORM public.populate_match_roster_from_pair(v_new_match_id, v_winner_a, 'A');
  PERFORM public.populate_match_roster_from_pair(v_new_match_id, v_winner_b, 'B');
END;
$$;

-- ── record_tournament_match_result_as_referee ─────────────────────────────────

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

  IF v_match.status NOT IN ('in_progress', 'planned') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  IF p_team_a_games < 0 OR p_team_a_games > 6 OR p_team_b_games < 0 OR p_team_b_games > 6 THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;
  IF p_team_a_games = p_team_b_games THEN RAISE EXCEPTION 'tie_not_allowed'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games,
    submitted_by_team, submitted_by_user_id, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games,
    'A', auth.uid(), 'confirmed'
  );

  v_from_status := v_match.status;
  PERFORM set_config('app.suppress_match_change_notify', '1', true);
  UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;
  PERFORM set_config('app.suppress_match_change_notify', '0', true);

  INSERT INTO public.match_state_transitions (
    match_id, from_status, to_status, triggered_by, user_id, reason
  ) VALUES (
    p_match_id, v_from_status, 'finished', 'user', auth.uid(), 'referee result'
  );

  PERFORM public.advance_tournament_round(p_match_id);
END;
$$;

-- ── Extend result confirmation to advance tournament ──────────────────────────

CREATE OR REPLACE FUNCTION public.fn_process_result_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mr            public.match_results%ROWTYPE;
  m             public.matches%ROWTYPE;
  v_from_status TEXT;
BEGIN
  SELECT * INTO mr FROM public.match_results WHERE id = NEW.match_result_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF mr.status IS DISTINCT FROM 'pending_validation' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = mr.match_id
      AND mp.user_id = NEW.user_id
      AND mp.team = NEW.team
      AND mp.state = 'confirmed'
      AND mp.left_at IS NULL
  ) THEN
    RAISE EXCEPTION '%', 'Datos de confirmación no válidos.';
  END IF;

  IF NEW.decision = 'dispute' THEN
    IF NEW.team = mr.submitted_by_team THEN
      RAISE EXCEPTION '%', 'Solo el equipo rival puede disputar el resultado.';
    END IF;

    UPDATE public.match_results
    SET status = 'disputed', updated_at = NOW()
    WHERE id = mr.id AND status = 'pending_validation';

    INSERT INTO public.reports (target_type, target_id, reason, notes, reporter_id)
    VALUES (
      'result',
      mr.id,
      'Disputa del resultado de partida',
      NULLIF(btrim(COALESCE(NEW.comment, '')), ''),
      NEW.user_id
    );

    RETURN NEW;
  END IF;

  IF NEW.decision = 'approve' THEN
    IF NEW.team = mr.submitted_by_team THEN
      RAISE EXCEPTION '%', 'Solo el equipo rival puede aprobar el resultado.';
    END IF;

    UPDATE public.match_results
    SET status = 'confirmed', updated_at = NOW()
    WHERE id = mr.id AND status = 'pending_validation';

    SELECT * INTO m FROM public.matches WHERE id = mr.match_id;

    IF FOUND AND m.status IN ('in_progress', 'finished_no_result') THEN
      v_from_status := m.status;
      PERFORM set_config('app.suppress_match_change_notify', '1', true);
      UPDATE public.matches
      SET status = 'finished', updated_at = NOW()
      WHERE id = m.id;
      PERFORM set_config('app.suppress_match_change_notify', '0', true);

      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, user_id, reason)
      VALUES
        (m.id, v_from_status, 'finished', 'user', NEW.user_id, 'Resultado confirmado');

      IF m.tournament_id IS NOT NULL THEN
        PERFORM public.advance_tournament_round(m.id);
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ── list_tournament_bracket ───────────────────────────────────────────────────

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
  ORDER BY m.tournament_round_size DESC, m.tournament_bracket_position ASC;
$$;

GRANT EXECUTE ON FUNCTION public.auth_can_read_tournament(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tournament_pair(UUID, TEXT, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tournament_pair(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tournament_bracket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_tournament_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tournament_match_result_as_referee(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tournament_bracket(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.populate_match_roster_from_pair(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_pow2(INT) FROM PUBLIC;
