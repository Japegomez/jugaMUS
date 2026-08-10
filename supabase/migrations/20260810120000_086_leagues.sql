-- Migration 086: Leagues (round-robin + open Elo), pairs, challenges, standings, Elo.

-- ── leagues ───────────────────────────────────────────────────────────────────

CREATE TABLE public.leagues (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  notes                 TEXT,
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  city                  TEXT NOT NULL,
  place_text            TEXT,
  place_defined         BOOLEAN NOT NULL DEFAULT TRUE,
  location_privacy      TEXT NOT NULL DEFAULT 'participants_only'
                          CHECK (location_privacy IN ('public_city_only', 'participants_only')),
  duration_target_games INT NOT NULL CHECK (duration_target_games BETWEEN 1 AND 6),
  visibility            TEXT NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'link', 'private')),
  password_hash         TEXT,
  format                TEXT NOT NULL
                          CHECK (format IN ('single_round', 'double_round', 'open_elo')),
  elo_initial           INT NOT NULL DEFAULT 1000 CHECK (elo_initial BETWEEN 100 AND 3000),
  elo_k_factor          INT NOT NULL DEFAULT 32 CHECK (elo_k_factor BETWEEN 1 AND 128),
  creator_id            UUID NOT NULL REFERENCES public.profiles(id),
  status                TEXT NOT NULL DEFAULT 'registration'
                          CHECK (status IN ('registration', 'in_progress', 'finished', 'cancelled')),
  fixtures_generated_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leagues_open_elo_requires_end_at CHECK (
    format <> 'open_elo' OR end_at IS NOT NULL
  ),
  CONSTRAINT leagues_end_after_start CHECK (
    end_at IS NULL OR end_at > start_at
  )
);

CREATE OR REPLACE FUNCTION public.set_leagues_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_leagues_updated_at();

CREATE INDEX idx_leagues_search ON public.leagues (city, start_at, status);
CREATE INDEX idx_leagues_creator ON public.leagues (creator_id, created_at DESC);
CREATE INDEX idx_leagues_end_at ON public.leagues (end_at) WHERE format = 'open_elo';

-- ── league_pairs ──────────────────────────────────────────────────────────────

CREATE TABLE public.league_pairs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  name_is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  player_a_user_id   UUID REFERENCES public.profiles(id),
  player_a_text      TEXT,
  player_b_user_id   UUID REFERENCES public.profiles(id),
  player_b_text      TEXT,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  current_elo        INT NOT NULL DEFAULT 1000,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT league_pairs_slot_a_xor CHECK (
    (player_a_user_id IS NULL AND player_a_text IS NULL)
    OR (player_a_user_id IS NOT NULL AND player_a_text IS NULL)
    OR (player_a_user_id IS NULL AND player_a_text IS NOT NULL)
  ),
  CONSTRAINT league_pairs_slot_b_xor CHECK (
    (player_b_user_id IS NULL AND player_b_text IS NULL)
    OR (player_b_user_id IS NOT NULL AND player_b_text IS NULL)
    OR (player_b_user_id IS NULL AND player_b_text IS NOT NULL)
  ),
  CONSTRAINT league_pairs_at_least_one_player CHECK (
    player_a_user_id IS NOT NULL OR player_a_text IS NOT NULL
    OR player_b_user_id IS NOT NULL OR player_b_text IS NOT NULL
  )
);

CREATE INDEX idx_league_pairs_league ON public.league_pairs (league_id);

CREATE OR REPLACE FUNCTION public.set_league_pairs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER league_pairs_updated_at
  BEFORE UPDATE ON public.league_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_pairs_updated_at();

-- ── league_challenges (open_elo) ───────────────────────────────────────────────

CREATE TABLE public.league_challenges (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id           UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  challenger_pair_id  UUID NOT NULL REFERENCES public.league_pairs(id) ON DELETE CASCADE,
  challenged_pair_id  UUID NOT NULL REFERENCES public.league_pairs(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  match_id            UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_by_user_id  UUID NOT NULL REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at        TIMESTAMPTZ,
  CONSTRAINT league_challenges_distinct_pairs CHECK (challenger_pair_id <> challenged_pair_id)
);

CREATE INDEX idx_league_challenges_league ON public.league_challenges (league_id, status);
CREATE UNIQUE INDEX idx_league_challenges_pending_unique
  ON public.league_challenges (league_id, challenger_pair_id, challenged_pair_id)
  WHERE status = 'pending';

-- ── league_rating_history ─────────────────────────────────────────────────────

CREATE TABLE public.league_rating_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  pair_id     UUID NOT NULL REFERENCES public.league_pairs(id) ON DELETE CASCADE,
  match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  elo_before  INT NOT NULL,
  elo_delta   INT NOT NULL,
  elo_after   INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_league_rating_history_pair ON public.league_rating_history (pair_id, created_at DESC);
CREATE UNIQUE INDEX idx_league_rating_history_match_pair
  ON public.league_rating_history (match_id, pair_id);

-- ── league_password_grants ────────────────────────────────────────────────────

CREATE TABLE public.league_password_grants (
  league_id  UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

-- ── matches: league columns ───────────────────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS league_pair_a_id UUID REFERENCES public.league_pairs(id),
  ADD COLUMN IF NOT EXISTS league_pair_b_id UUID REFERENCES public.league_pairs(id),
  ADD COLUMN IF NOT EXISTS league_round_number INT,
  ADD COLUMN IF NOT EXISTS league_is_second_leg BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_matches_league ON public.matches (league_id);

-- ── helpers ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_can_read_league(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = p_league_id
      AND (
        l.visibility = 'public'
        OR l.visibility = 'link'
        OR l.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.league_pairs lp
          WHERE lp.league_id = l.id
            AND (
              lp.player_a_user_id = auth.uid()
              OR lp.player_b_user_id = auth.uid()
              OR lp.created_by_user_id = auth.uid()
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.league_password_grants g
          WHERE g.league_id = l.id AND g.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.league_pair_is_complete(p_pair public.league_pairs)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    (p_pair.player_a_user_id IS NOT NULL OR NULLIF(BTRIM(COALESCE(p_pair.player_a_text, '')), '') IS NOT NULL)
    AND (p_pair.player_b_user_id IS NOT NULL OR NULLIF(BTRIM(COALESCE(p_pair.player_b_text, '')), '') IS NOT NULL);
$$;

CREATE OR REPLACE FUNCTION public.user_is_in_league_pair(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_pairs
    WHERE league_id = p_league_id
      AND (player_a_user_id = p_user_id OR player_b_user_id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.populate_match_roster_from_league_pair(
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
  v_pair public.league_pairs%ROWTYPE;
BEGIN
  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id;
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

CREATE OR REPLACE FUNCTION public.create_league_match(
  p_league public.leagues,
  p_pair_a_id UUID,
  p_pair_b_id UUID,
  p_round_number INT,
  p_is_second_leg BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
  v_pair_a_name TEXT;
  v_pair_b_name TEXT;
  v_title TEXT;
BEGIN
  SELECT name INTO v_pair_a_name FROM public.league_pairs WHERE id = p_pair_a_id;
  SELECT name INTO v_pair_b_name FROM public.league_pairs WHERE id = p_pair_b_id;

  v_title := p_league.title || ' — J' || COALESCE(p_round_number::TEXT, '?');
  IF p_is_second_leg THEN
    v_title := v_title || ' (vuelta)';
  END IF;

  INSERT INTO public.matches (
    title, start_at, city, place_defined, place_text,
    duration_target_games, visibility, location_privacy,
    creator_id, status,
    league_id, league_pair_a_id, league_pair_b_id,
    league_round_number, league_is_second_leg,
    team_a_name, team_b_name
  ) VALUES (
    v_title,
    p_league.start_at, p_league.city, p_league.place_defined, p_league.place_text,
    p_league.duration_target_games, p_league.visibility, p_league.location_privacy,
    p_league.creator_id, 'planned',
    p_league.id, p_pair_a_id, p_pair_b_id,
    p_round_number, COALESCE(p_is_second_leg, FALSE),
    COALESCE(v_pair_a_name, 'Pareja A'), COALESCE(v_pair_b_name, 'Pareja B')
  )
  RETURNING id INTO v_match_id;

  PERFORM public.populate_match_roster_from_league_pair(v_match_id, p_pair_a_id, 'A');
  PERFORM public.populate_match_roster_from_league_pair(v_match_id, p_pair_b_id, 'B');

  RETURN v_match_id;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_password_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY leagues_select ON public.leagues
  FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'private')
    OR creator_id = auth.uid()
    OR visibility = 'link'
    OR EXISTS (
      SELECT 1 FROM public.league_pairs lp
      WHERE lp.league_id = leagues.id
        AND (
          lp.player_a_user_id = auth.uid()
          OR lp.player_b_user_id = auth.uid()
          OR lp.created_by_user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.league_password_grants g
      WHERE g.league_id = leagues.id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY leagues_insert ON public.leagues
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY leagues_update ON public.leagues
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY league_pairs_select ON public.league_pairs
  FOR SELECT TO authenticated
  USING (public.auth_can_read_league(league_id));

CREATE POLICY league_pairs_insert ON public.league_pairs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_read_league(league_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_id AND l.status IN ('registration', 'in_progress')
    )
  );

CREATE POLICY league_pairs_update ON public.league_pairs
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR player_a_user_id = auth.uid()
    OR player_b_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_pairs.league_id AND l.creator_id = auth.uid()
    )
  );

CREATE POLICY league_pairs_delete ON public.league_pairs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_pairs.league_id
        AND l.creator_id = auth.uid()
        AND l.status = 'registration'
        AND l.fixtures_generated_at IS NULL
    )
  );

CREATE POLICY league_challenges_select ON public.league_challenges
  FOR SELECT TO authenticated
  USING (public.auth_can_read_league(league_id));

CREATE POLICY league_rating_history_select ON public.league_rating_history
  FOR SELECT TO authenticated
  USING (public.auth_can_read_league(league_id));

CREATE POLICY league_password_grants_select_self ON public.league_password_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
    OR (
      league_id IS NOT NULL
      AND public.auth_can_read_league(league_id)
    )
  );

-- ── create_league ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_league(
  p_title TEXT,
  p_start_at TIMESTAMPTZ,
  p_city TEXT,
  p_duration_target_games INT,
  p_format TEXT,
  p_end_at TIMESTAMPTZ DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_place_defined BOOLEAN DEFAULT TRUE,
  p_place_text TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_location_privacy TEXT DEFAULT 'participants_only',
  p_elo_initial INT DEFAULT 1000,
  p_elo_k_factor INT DEFAULT 32
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.leagues%ROWTYPE;
  v_format TEXT := COALESCE(NULLIF(BTRIM(p_format), ''), 'single_round');
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

  IF v_format NOT IN ('single_round', 'double_round', 'open_elo') THEN
    RAISE EXCEPTION 'invalid_format';
  END IF;

  IF v_format = 'open_elo' AND p_end_at IS NULL THEN
    RAISE EXCEPTION 'end_at_required_for_open_elo';
  END IF;

  IF p_end_at IS NOT NULL AND p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'end_at_must_be_after_start_at';
  END IF;

  INSERT INTO public.leagues (
    title, description, notes, start_at, end_at, city,
    place_defined, place_text, duration_target_games,
    visibility, location_privacy, format, elo_initial, elo_k_factor,
    creator_id, status
  ) VALUES (
    BTRIM(p_title),
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_notes), ''),
    p_start_at,
    CASE WHEN v_format = 'open_elo' THEN p_end_at ELSE p_end_at END,
    BTRIM(p_city),
    COALESCE(p_place_defined, TRUE),
    CASE WHEN COALESCE(p_place_defined, TRUE) THEN NULLIF(BTRIM(p_place_text), '') ELSE NULL END,
    p_duration_target_games,
    COALESCE(p_visibility, 'public'),
    COALESCE(p_location_privacy, 'participants_only'),
    v_format,
    COALESCE(p_elo_initial, 1000),
    COALESCE(p_elo_k_factor, 32),
    auth.uid(),
    'registration'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_league(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INT, INT
) TO authenticated;

-- ── password helpers ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.viewer_can_access_league(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_can_read_league(p_league_id);
$$;

CREATE OR REPLACE FUNCTION public.set_league_password(
  p_league_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NULLIF(BTRIM(p_password), '') IS NULL THEN RAISE EXCEPTION 'password_empty'; END IF;

  UPDATE public.leagues
  SET
    visibility = 'private',
    password_hash = crypt(BTRIM(p_password), gen_salt('bf'))
  WHERE id = p_league_id
    AND creator_id = auth.uid();

  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
      RAISE EXCEPTION 'league_not_found';
    END IF;
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_league_password_access(
  p_league_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT password_hash INTO v_hash
  FROM public.leagues
  WHERE id = p_league_id AND visibility = 'private';

  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'league_no_password'; END IF;
  IF v_hash <> crypt(BTRIM(p_password), v_hash) THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.league_password_grants (league_id, user_id)
  VALUES (p_league_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.viewer_can_access_league(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_league_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_league_password_access(UUID, TEXT) TO authenticated;

-- ── add / join / update / remove pair ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_league_pair(
  p_league_id UUID,
  p_name TEXT DEFAULT '',
  p_player_a_user_id UUID DEFAULT NULL,
  p_player_a_text TEXT DEFAULT NULL,
  p_player_b_user_id UUID DEFAULT NULL,
  p_player_b_text TEXT DEFAULT NULL
)
RETURNS public.league_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_row public.league_pairs%ROWTYPE;
  v_name TEXT;
  v_name_custom BOOLEAN := FALSE;
  v_a_text TEXT := NULLIF(BTRIM(COALESCE(p_player_a_text, '')), '');
  v_b_text TEXT := NULLIF(BTRIM(COALESCE(p_player_b_text, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_league.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'league_not_accepting_pairs';
  END IF;
  IF v_league.format = 'open_elo' AND v_league.end_at IS NOT NULL AND NOW() > v_league.end_at THEN
    RAISE EXCEPTION 'league_ended';
  END IF;
  IF NOT public.auth_can_read_league(p_league_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_player_a_user_id IS NOT NULL AND public.user_is_in_league_pair(p_league_id, p_player_a_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;
  IF p_player_b_user_id IS NOT NULL AND public.user_is_in_league_pair(p_league_id, p_player_b_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  IF v_name IS NOT NULL THEN
    v_name_custom := TRUE;
  ELSE
    v_name := COALESCE(v_a_text, 'Jugador') || ' - ' || COALESCE(v_b_text, 'Jugador');
  END IF;

  INSERT INTO public.league_pairs (
    league_id, name, name_is_custom,
    player_a_user_id, player_a_text,
    player_b_user_id, player_b_text,
    created_by_user_id, current_elo
  ) VALUES (
    p_league_id, v_name, v_name_custom,
    p_player_a_user_id, v_a_text,
    p_player_b_user_id, v_b_text,
    auth.uid(),
    v_league.elo_initial
  )
  RETURNING * INTO v_row;

  -- Late join catch-up for round-robin after fixtures started
  IF v_league.status = 'in_progress'
     AND v_league.format IN ('single_round', 'double_round')
     AND v_league.fixtures_generated_at IS NOT NULL
     AND public.league_pair_is_complete(v_row)
  THEN
    PERFORM public.generate_league_catchup_matches(p_league_id, v_row.id);
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_league_catchup_matches(
  p_league_id UUID,
  p_new_pair_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_other RECORD;
BEGIN
  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_league.format NOT IN ('single_round', 'double_round') THEN RETURN; END IF;

  FOR v_other IN
    SELECT id FROM public.league_pairs
    WHERE league_id = p_league_id
      AND id <> p_new_pair_id
      AND public.league_pair_is_complete(league_pairs)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.league_id = p_league_id
        AND m.status <> 'cancelled'
        AND (
          (m.league_pair_a_id = p_new_pair_id AND m.league_pair_b_id = v_other.id)
          OR (m.league_pair_a_id = v_other.id AND m.league_pair_b_id = p_new_pair_id)
        )
        AND COALESCE(m.league_is_second_leg, FALSE) = FALSE
    ) THEN
      PERFORM public.create_league_match(v_league, p_new_pair_id, v_other.id, NULL, FALSE);
    END IF;

    IF v_league.format = 'double_round' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.league_id = p_league_id
          AND m.status <> 'cancelled'
          AND m.league_pair_a_id = v_other.id
          AND m.league_pair_b_id = p_new_pair_id
          AND COALESCE(m.league_is_second_leg, FALSE) = TRUE
      ) THEN
        PERFORM public.create_league_match(v_league, v_other.id, p_new_pair_id, NULL, TRUE);
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_league_pair(
  p_pair_id UUID,
  p_slot TEXT,
  p_as_text TEXT DEFAULT NULL
)
RETURNS public.league_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.league_pairs%ROWTYPE;
  v_league public.leagues%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pair_not_found'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_pair.league_id;
  IF v_league.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'league_not_accepting_pairs';
  END IF;
  IF NOT public.auth_can_read_league(v_pair.league_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF public.user_is_in_league_pair(v_pair.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  IF p_slot = 'a' THEN
    IF v_pair.player_a_user_id IS NOT NULL OR v_pair.player_a_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.league_pairs SET player_a_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.league_pairs SET player_a_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSIF p_slot = 'b' THEN
    IF v_pair.player_b_user_id IS NOT NULL OR v_pair.player_b_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.league_pairs SET player_b_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.league_pairs SET player_b_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id;

  IF v_league.status = 'in_progress'
     AND v_league.format IN ('single_round', 'double_round')
     AND v_league.fixtures_generated_at IS NOT NULL
     AND public.league_pair_is_complete(v_pair)
  THEN
    PERFORM public.generate_league_catchup_matches(v_league.id, v_pair.id);
  END IF;

  RETURN v_pair;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_league_pair(
  p_pair_id UUID,
  p_name TEXT DEFAULT '',
  p_player_a_text TEXT DEFAULT '',
  p_player_b_text TEXT DEFAULT ''
)
RETURNS public.league_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.league_pairs%ROWTYPE;
  v_league public.leagues%ROWTYPE;
  v_name TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pair_not_found'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_pair.league_id;
  IF v_league.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'league_not_accepting_pairs';
  END IF;

  IF v_league.creator_id <> auth.uid()
     AND v_pair.created_by_user_id <> auth.uid()
     AND v_pair.player_a_user_id <> auth.uid()
     AND v_pair.player_b_user_id <> auth.uid()
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_pair.player_a_text IS NOT NULL AND NULLIF(BTRIM(COALESCE(p_player_a_text, '')), '') IS NULL THEN
    RAISE EXCEPTION 'cannot_clear_text_player';
  END IF;
  IF v_pair.player_b_text IS NOT NULL AND NULLIF(BTRIM(COALESCE(p_player_b_text, '')), '') IS NULL THEN
    RAISE EXCEPTION 'cannot_clear_text_player';
  END IF;

  UPDATE public.league_pairs
  SET
    name = CASE WHEN v_name IS NOT NULL THEN v_name ELSE name END,
    name_is_custom = CASE WHEN v_name IS NOT NULL THEN TRUE ELSE name_is_custom END,
    player_a_text = CASE
      WHEN player_a_user_id IS NOT NULL THEN NULL
      ELSE COALESCE(NULLIF(BTRIM(COALESCE(p_player_a_text, '')), ''), player_a_text)
    END,
    player_b_text = CASE
      WHEN player_b_user_id IS NOT NULL THEN NULL
      ELSE COALESCE(NULLIF(BTRIM(COALESCE(p_player_b_text, '')), ''), player_b_text)
    END
  WHERE id = p_pair_id
  RETURNING * INTO v_pair;

  RETURN v_pair;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_league_pair(p_pair_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.league_pairs%ROWTYPE;
  v_league public.leagues%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pair_not_found'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_pair.league_id;
  IF v_league.creator_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_league.status <> 'registration' OR v_league.fixtures_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_remove_pair_after_start';
  END IF;

  DELETE FROM public.league_pairs WHERE id = p_pair_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_league_pair(UUID, TEXT, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league_pair(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_league_pair(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_league_pair(UUID) TO authenticated;

-- ── generate_league_fixtures (circle method) ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_league_fixtures(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_pair_ids UUID[];
  v_n INT;
  v_rounds INT;
  v_round INT;
  v_i INT;
  v_home UUID;
  v_away UUID;
  v_fixed UUID;
  v_rot UUID[];
  v_tmp UUID;
  v_half INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_league.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF v_league.status <> 'registration' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_league.format NOT IN ('single_round', 'double_round') THEN
    RAISE EXCEPTION 'fixtures_only_for_round_robin';
  END IF;
  IF v_league.fixtures_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'fixtures_already_generated';
  END IF;

  SELECT ARRAY_AGG(id ORDER BY created_at)
  INTO v_pair_ids
  FROM public.league_pairs
  WHERE league_id = p_league_id
    AND public.league_pair_is_complete(league_pairs);

  v_n := COALESCE(array_length(v_pair_ids, 1), 0);
  IF v_n < 2 THEN RAISE EXCEPTION 'need_at_least_two_complete_pairs'; END IF;

  -- Circle method: pad with NULL bye if odd
  IF v_n % 2 = 1 THEN
    v_pair_ids := v_pair_ids || ARRAY[NULL::UUID];
    v_n := v_n + 1;
  END IF;

  v_rounds := v_n - 1;
  v_half := v_n / 2;
  v_fixed := v_pair_ids[1];
  v_rot := v_pair_ids[2:v_n];

  FOR v_round IN 1..v_rounds LOOP
    -- Pair fixed with last of rot, then 1 with n-1, etc.
    v_home := v_fixed;
    v_away := v_rot[array_length(v_rot, 1)];
    IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
      IF v_round % 2 = 0 THEN
        PERFORM public.create_league_match(v_league, v_away, v_home, v_round, FALSE);
      ELSE
        PERFORM public.create_league_match(v_league, v_home, v_away, v_round, FALSE);
      END IF;
    END IF;

    FOR v_i IN 1..(v_half - 1) LOOP
      v_home := v_rot[v_i];
      v_away := v_rot[array_length(v_rot, 1) - v_i];
      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        IF (v_round + v_i) % 2 = 0 THEN
          PERFORM public.create_league_match(v_league, v_away, v_home, v_round, FALSE);
        ELSE
          PERFORM public.create_league_match(v_league, v_home, v_away, v_round, FALSE);
        END IF;
      END IF;
    END LOOP;

    -- Rotate: last of rot moves to front
    v_tmp := v_rot[array_length(v_rot, 1)];
    v_rot := ARRAY[v_tmp] || v_rot[1:array_length(v_rot, 1) - 1];
  END LOOP;

  IF v_league.format = 'double_round' THEN
    -- Second leg: reverse home/away for every first-leg match
    INSERT INTO public.matches (
      title, start_at, city, place_defined, place_text,
      duration_target_games, visibility, location_privacy,
      creator_id, status,
      league_id, league_pair_a_id, league_pair_b_id,
      league_round_number, league_is_second_leg,
      team_a_name, team_b_name
    )
    SELECT
      v_league.title || ' — J' || (m.league_round_number + v_rounds)::TEXT || ' (vuelta)',
      v_league.start_at, v_league.city, v_league.place_defined, v_league.place_text,
      v_league.duration_target_games, v_league.visibility, v_league.location_privacy,
      v_league.creator_id, 'planned',
      p_league_id, m.league_pair_b_id, m.league_pair_a_id,
      m.league_round_number + v_rounds, TRUE,
      m.team_b_name, m.team_a_name
    FROM public.matches m
    WHERE m.league_id = p_league_id
      AND COALESCE(m.league_is_second_leg, FALSE) = FALSE;

    -- Populate rosters for second-leg matches
    FOR v_i IN
      SELECT id, league_pair_a_id, league_pair_b_id
      FROM public.matches
      WHERE league_id = p_league_id AND league_is_second_leg = TRUE
    LOOP
      PERFORM public.populate_match_roster_from_league_pair(v_i.id, v_i.league_pair_a_id, 'A');
      PERFORM public.populate_match_roster_from_league_pair(v_i.id, v_i.league_pair_b_id, 'B');
    END LOOP;
  END IF;

  UPDATE public.leagues
  SET status = 'in_progress', fixtures_generated_at = NOW()
  WHERE id = p_league_id;
END;
$$;

-- Fix: FOR loop variable type for second-leg roster population
CREATE OR REPLACE FUNCTION public.generate_league_fixtures(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_pair_ids UUID[];
  v_n INT;
  v_rounds INT;
  v_round INT;
  v_i INT;
  v_home UUID;
  v_away UUID;
  v_fixed UUID;
  v_rot UUID[];
  v_tmp UUID;
  v_half INT;
  v_leg RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_league.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF v_league.status <> 'registration' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_league.format NOT IN ('single_round', 'double_round') THEN
    RAISE EXCEPTION 'fixtures_only_for_round_robin';
  END IF;
  IF v_league.fixtures_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'fixtures_already_generated';
  END IF;

  SELECT ARRAY_AGG(id ORDER BY created_at)
  INTO v_pair_ids
  FROM public.league_pairs
  WHERE league_id = p_league_id
    AND public.league_pair_is_complete(league_pairs);

  v_n := COALESCE(array_length(v_pair_ids, 1), 0);
  IF v_n < 2 THEN RAISE EXCEPTION 'need_at_least_two_complete_pairs'; END IF;

  IF v_n % 2 = 1 THEN
    v_pair_ids := v_pair_ids || ARRAY[NULL::UUID];
    v_n := v_n + 1;
  END IF;

  v_rounds := v_n - 1;
  v_half := v_n / 2;
  v_fixed := v_pair_ids[1];
  v_rot := v_pair_ids[2:v_n];

  FOR v_round IN 1..v_rounds LOOP
    v_home := v_fixed;
    v_away := v_rot[array_length(v_rot, 1)];
    IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
      IF v_round % 2 = 0 THEN
        PERFORM public.create_league_match(v_league, v_away, v_home, v_round, FALSE);
      ELSE
        PERFORM public.create_league_match(v_league, v_home, v_away, v_round, FALSE);
      END IF;
    END IF;

    FOR v_i IN 1..(v_half - 1) LOOP
      v_home := v_rot[v_i];
      v_away := v_rot[array_length(v_rot, 1) - v_i];
      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        IF (v_round + v_i) % 2 = 0 THEN
          PERFORM public.create_league_match(v_league, v_away, v_home, v_round, FALSE);
        ELSE
          PERFORM public.create_league_match(v_league, v_home, v_away, v_round, FALSE);
        END IF;
      END IF;
    END LOOP;

    v_tmp := v_rot[array_length(v_rot, 1)];
    v_rot := ARRAY[v_tmp] || v_rot[1:array_length(v_rot, 1) - 1];
  END LOOP;

  IF v_league.format = 'double_round' THEN
    INSERT INTO public.matches (
      title, start_at, city, place_defined, place_text,
      duration_target_games, visibility, location_privacy,
      creator_id, status,
      league_id, league_pair_a_id, league_pair_b_id,
      league_round_number, league_is_second_leg,
      team_a_name, team_b_name
    )
    SELECT
      v_league.title || ' — J' || (m.league_round_number + v_rounds)::TEXT || ' (vuelta)',
      v_league.start_at, v_league.city, v_league.place_defined, v_league.place_text,
      v_league.duration_target_games, v_league.visibility, v_league.location_privacy,
      v_league.creator_id, 'planned',
      p_league_id, m.league_pair_b_id, m.league_pair_a_id,
      m.league_round_number + v_rounds, TRUE,
      m.team_b_name, m.team_a_name
    FROM public.matches m
    WHERE m.league_id = p_league_id
      AND COALESCE(m.league_is_second_leg, FALSE) = FALSE;

    FOR v_leg IN
      SELECT id, league_pair_a_id, league_pair_b_id
      FROM public.matches
      WHERE league_id = p_league_id AND league_is_second_leg = TRUE
    LOOP
      PERFORM public.populate_match_roster_from_league_pair(v_leg.id, v_leg.league_pair_a_id, 'A');
      PERFORM public.populate_match_roster_from_league_pair(v_leg.id, v_leg.league_pair_b_id, 'B');
    END LOOP;
  END IF;

  UPDATE public.leagues
  SET status = 'in_progress', fixtures_generated_at = NOW()
  WHERE id = p_league_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_league_fixtures(UUID) TO authenticated;

-- Start open_elo league (no fixtures)
CREATE OR REPLACE FUNCTION public.start_open_league(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_n INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_league.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF v_league.status <> 'registration' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_league.format <> 'open_elo' THEN RAISE EXCEPTION 'not_open_elo'; END IF;
  IF v_league.end_at IS NULL OR v_league.end_at <= NOW() THEN
    RAISE EXCEPTION 'end_at_invalid';
  END IF;

  SELECT COUNT(*) INTO v_n
  FROM public.league_pairs
  WHERE league_id = p_league_id
    AND public.league_pair_is_complete(league_pairs);

  IF v_n < 2 THEN RAISE EXCEPTION 'need_at_least_two_complete_pairs'; END IF;

  UPDATE public.leagues
  SET status = 'in_progress'
  WHERE id = p_league_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_open_league(UUID) TO authenticated;

-- ── challenges ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_league_challenge(
  p_league_id UUID,
  p_challenged_pair_id UUID
)
RETURNS public.league_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_challenger_id UUID;
  v_row public.league_challenges%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_league.format <> 'open_elo' THEN RAISE EXCEPTION 'not_open_elo'; END IF;
  IF v_league.status <> 'in_progress' THEN RAISE EXCEPTION 'league_not_in_progress'; END IF;
  IF v_league.end_at IS NOT NULL AND NOW() > v_league.end_at THEN
    RAISE EXCEPTION 'league_ended';
  END IF;

  SELECT id INTO v_challenger_id
  FROM public.league_pairs
  WHERE league_id = p_league_id
    AND (player_a_user_id = auth.uid() OR player_b_user_id = auth.uid())
  LIMIT 1;

  IF v_challenger_id IS NULL THEN RAISE EXCEPTION 'not_in_league_pair'; END IF;
  IF v_challenger_id = p_challenged_pair_id THEN RAISE EXCEPTION 'cannot_challenge_self'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.league_pairs
    WHERE id = p_challenged_pair_id AND league_id = p_league_id
      AND public.league_pair_is_complete(league_pairs)
  ) THEN
    RAISE EXCEPTION 'challenged_pair_invalid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_challenges
    WHERE league_id = p_league_id
      AND status = 'pending'
      AND (
        (challenger_pair_id = v_challenger_id AND challenged_pair_id = p_challenged_pair_id)
        OR (challenger_pair_id = p_challenged_pair_id AND challenged_pair_id = v_challenger_id)
      )
  ) THEN
    RAISE EXCEPTION 'challenge_already_pending';
  END IF;

  INSERT INTO public.league_challenges (
    league_id, challenger_pair_id, challenged_pair_id,
    status, created_by_user_id
  ) VALUES (
    p_league_id, v_challenger_id, p_challenged_pair_id,
    'pending', auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_league_challenge(p_challenge_id UUID)
RETURNS public.league_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch public.league_challenges%ROWTYPE;
  v_league public.leagues%ROWTYPE;
  v_match_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_ch FROM public.league_challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF v_ch.status <> 'pending' THEN RAISE EXCEPTION 'challenge_not_pending'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_ch.league_id;
  IF v_league.end_at IS NOT NULL AND NOW() > v_league.end_at THEN
    UPDATE public.league_challenges SET status = 'expired', responded_at = NOW()
    WHERE id = p_challenge_id;
    RAISE EXCEPTION 'league_ended';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.league_pairs
    WHERE id = v_ch.challenged_pair_id
      AND (player_a_user_id = auth.uid() OR player_b_user_id = auth.uid())
  ) AND v_league.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_match_id := public.create_league_match(
    v_league, v_ch.challenger_pair_id, v_ch.challenged_pair_id, NULL, FALSE
  );

  UPDATE public.matches SET status = 'in_progress', start_at = NOW() WHERE id = v_match_id;

  UPDATE public.league_challenges
  SET status = 'accepted', match_id = v_match_id, responded_at = NOW()
  WHERE id = p_challenge_id
  RETURNING * INTO v_ch;

  RETURN v_ch;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_league_challenge(p_challenge_id UUID)
RETURNS public.league_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch public.league_challenges%ROWTYPE;
  v_league public.leagues%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_ch FROM public.league_challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF v_ch.status <> 'pending' THEN RAISE EXCEPTION 'challenge_not_pending'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_ch.league_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.league_pairs
    WHERE id = v_ch.challenged_pair_id
      AND (player_a_user_id = auth.uid() OR player_b_user_id = auth.uid())
  ) AND v_league.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.league_challenges
  SET status = 'rejected', responded_at = NOW()
  WHERE id = p_challenge_id
  RETURNING * INTO v_ch;

  RETURN v_ch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_league_challenge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_league_challenge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_league_challenge(UUID) TO authenticated;

-- ── standings ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_league_standings(p_league_id UUID)
RETURNS TABLE (
  pair_id UUID,
  pair_name TEXT,
  played INT,
  wins INT,
  losses INT,
  games_for INT,
  games_against INT,
  games_diff INT,
  h2h_wins INT,
  current_elo INT,
  rank INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_can_read_league(p_league_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH confirmed AS (
    SELECT
      m.league_pair_a_id AS pair_a,
      m.league_pair_b_id AS pair_b,
      mr.team_a_games,
      mr.team_b_games
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE m.league_id = p_league_id
      AND m.status = 'finished'
      AND m.league_pair_a_id IS NOT NULL
      AND m.league_pair_b_id IS NOT NULL
  ),
  stats AS (
    SELECT
      lp.id AS pair_id,
      lp.name AS pair_name,
      lp.current_elo,
      COALESCE((
        SELECT COUNT(*)::INT FROM confirmed c
        WHERE c.pair_a = lp.id OR c.pair_b = lp.id
      ), 0) AS played,
      COALESCE((
        SELECT COUNT(*)::INT FROM confirmed c
        WHERE (c.pair_a = lp.id AND c.team_a_games > c.team_b_games)
           OR (c.pair_b = lp.id AND c.team_b_games > c.team_a_games)
      ), 0) AS wins,
      COALESCE((
        SELECT COUNT(*)::INT FROM confirmed c
        WHERE (c.pair_a = lp.id AND c.team_a_games < c.team_b_games)
           OR (c.pair_b = lp.id AND c.team_b_games < c.team_a_games)
      ), 0) AS losses,
      COALESCE((
        SELECT SUM(CASE WHEN c.pair_a = lp.id THEN c.team_a_games ELSE c.team_b_games END)::INT
        FROM confirmed c WHERE c.pair_a = lp.id OR c.pair_b = lp.id
      ), 0) AS games_for,
      COALESCE((
        SELECT SUM(CASE WHEN c.pair_a = lp.id THEN c.team_b_games ELSE c.team_a_games END)::INT
        FROM confirmed c WHERE c.pair_a = lp.id OR c.pair_b = lp.id
      ), 0) AS games_against
    FROM public.league_pairs lp
    WHERE lp.league_id = p_league_id
  ),
  with_h2h AS (
    SELECT
      s.*,
      (s.games_for - s.games_against) AS games_diff,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM confirmed c
        JOIN stats s2 ON s2.pair_id <> s.pair_id AND s2.wins = s.wins
        WHERE (
          (c.pair_a = s.pair_id AND c.pair_b = s2.pair_id AND c.team_a_games > c.team_b_games)
          OR (c.pair_b = s.pair_id AND c.pair_a = s2.pair_id AND c.team_b_games > c.team_a_games)
        )
      ), 0) AS h2h_wins
    FROM stats s
  ),
  ordered AS (
    SELECT
      w.*,
      ROW_NUMBER() OVER (
        ORDER BY w.wins DESC, w.h2h_wins DESC, w.games_diff DESC, w.games_for DESC, w.pair_id
      )::INT AS rank
    FROM with_h2h w
  )
  SELECT
    o.pair_id, o.pair_name, o.played, o.wins, o.losses,
    o.games_for, o.games_against, o.games_diff, o.h2h_wins, o.current_elo, o.rank
  FROM ordered o
  ORDER BY o.rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_league_standings(UUID) TO authenticated;

-- ── Elo + finish ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_league_elo(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_league public.leagues%ROWTYPE;
  v_result public.match_results%ROWTYPE;
  v_pair_a public.league_pairs%ROWTYPE;
  v_pair_b public.league_pairs%ROWTYPE;
  v_ra NUMERIC;
  v_rb NUMERIC;
  v_ea NUMERIC;
  v_eb NUMERIC;
  v_sa NUMERIC;
  v_sb NUMERIC;
  v_da INT;
  v_db INT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.league_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_match.league_id;
  IF NOT FOUND OR v_league.format <> 'open_elo' THEN RETURN; END IF;

  SELECT * INTO v_result
  FROM public.match_results
  WHERE match_id = p_match_id AND status = 'confirmed'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_rating_history WHERE match_id = p_match_id
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_pair_a FROM public.league_pairs WHERE id = v_match.league_pair_a_id FOR UPDATE;
  SELECT * INTO v_pair_b FROM public.league_pairs WHERE id = v_match.league_pair_b_id FOR UPDATE;
  IF NOT FOUND OR v_pair_a.id IS NULL OR v_pair_b.id IS NULL THEN RETURN; END IF;

  v_ra := v_pair_a.current_elo;
  v_rb := v_pair_b.current_elo;
  v_ea := 1.0 / (1.0 + POWER(10.0, (v_rb - v_ra) / 400.0));
  v_eb := 1.0 - v_ea;

  IF v_result.team_a_games > v_result.team_b_games THEN
    v_sa := 1; v_sb := 0;
  ELSE
    v_sa := 0; v_sb := 1;
  END IF;

  v_da := ROUND(v_league.elo_k_factor * (v_sa - v_ea))::INT;
  v_db := ROUND(v_league.elo_k_factor * (v_sb - v_eb))::INT;

  UPDATE public.league_pairs SET current_elo = current_elo + v_da WHERE id = v_pair_a.id;
  UPDATE public.league_pairs SET current_elo = current_elo + v_db WHERE id = v_pair_b.id;

  INSERT INTO public.league_rating_history (league_id, pair_id, match_id, elo_before, elo_delta, elo_after)
  VALUES
    (v_league.id, v_pair_a.id, p_match_id, v_pair_a.current_elo, v_da, v_pair_a.current_elo + v_da),
    (v_league.id, v_pair_b.id, p_match_id, v_pair_b.current_elo, v_db, v_pair_b.current_elo + v_db);
END;
$$;

CREATE OR REPLACE FUNCTION public.maybe_finish_league(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_pending INT;
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

  SELECT COUNT(*) INTO v_pending
  FROM public.matches
  WHERE league_id = p_league_id
    AND status NOT IN ('finished', 'finished_no_result', 'cancelled');

  IF v_pending = 0 THEN
    UPDATE public.leagues SET status = 'finished' WHERE id = p_league_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_league_match_result_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_id UUID;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT league_id INTO v_league_id FROM public.matches WHERE id = NEW.match_id;
    IF v_league_id IS NOT NULL THEN
      PERFORM public.recalculate_league_elo(NEW.match_id);
      PERFORM public.maybe_finish_league(v_league_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS league_match_result_confirmed ON public.match_results;
CREATE TRIGGER league_match_result_confirmed
  AFTER UPDATE OF status ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.on_league_match_result_confirmed();

-- ── cancel / lifecycle ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_all_league_matches(p_league_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'cancelled'
  WHERE league_id = p_league_id
    AND status IN ('planned', 'in_progress');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_league(p_league_id UUID)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.leagues%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_row.creator_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'league_not_cancellable';
  END IF;

  PERFORM public.cancel_all_league_matches(p_league_id);

  UPDATE public.league_challenges
  SET status = 'expired', responded_at = COALESCE(responded_at, NOW())
  WHERE league_id = p_league_id AND status = 'pending';

  UPDATE public.leagues SET status = 'cancelled' WHERE id = p_league_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_league_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league RECORD;
BEGIN
  -- Finish open leagues past end_at (grace: cancel unfinished matches older than end_at + 24h)
  FOR v_league IN
    SELECT id, end_at FROM public.leagues
    WHERE format = 'open_elo'
      AND status = 'in_progress'
      AND end_at IS NOT NULL
      AND NOW() > end_at
  LOOP
    UPDATE public.league_challenges
    SET status = 'expired', responded_at = COALESCE(responded_at, NOW())
    WHERE league_id = v_league.id AND status = 'pending';

    IF NOW() > v_league.end_at + INTERVAL '24 hours' THEN
      UPDATE public.matches
      SET status = 'cancelled'
      WHERE league_id = v_league.id
        AND status IN ('planned', 'in_progress');
    END IF;

    PERFORM public.maybe_finish_league(v_league.id);
  END LOOP;

  -- Auto-finish round-robin when all matches done
  FOR v_league IN
    SELECT id FROM public.leagues
    WHERE format IN ('single_round', 'double_round')
      AND status = 'in_progress'
  LOOP
    PERFORM public.maybe_finish_league(v_league.id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_league(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_league_lifecycle() TO authenticated;

-- ── referee result for league matches ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_league_match_result_as_referee(
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
  v_league public.leagues%ROWTYPE;
  v_result_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.league_id IS NULL THEN RAISE EXCEPTION 'not_league_match'; END IF;

  SELECT * INTO v_league FROM public.leagues WHERE id = v_match.league_id;
  IF v_league.creator_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_team_a_games = p_team_b_games THEN RAISE EXCEPTION 'tie_not_allowed'; END IF;
  IF GREATEST(p_team_a_games, p_team_b_games) <> v_match.duration_target_games THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games,
    submitted_by_user_id, submitted_by_team, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games,
    auth.uid(), 'A', 'confirmed'
  )
  RETURNING id INTO v_result_id;

  UPDATE public.matches SET status = 'finished' WHERE id = p_match_id;

  PERFORM public.recalculate_league_elo(p_match_id);
  PERFORM public.maybe_finish_league(v_league.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_league_match_result_as_referee(UUID, INT, INT) TO authenticated;

-- list league matches helper
CREATE OR REPLACE FUNCTION public.list_league_matches(p_league_id UUID)
RETURNS TABLE (
  match_id UUID,
  title TEXT,
  start_at TIMESTAMPTZ,
  status TEXT,
  pair_a_id UUID,
  pair_a_name TEXT,
  pair_b_id UUID,
  pair_b_name TEXT,
  round_number INT,
  is_second_leg BOOLEAN,
  team_a_games INT,
  team_b_games INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_can_read_league(p_league_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.start_at,
    m.status,
    m.league_pair_a_id,
    pa.name,
    m.league_pair_b_id,
    pb.name,
    m.league_round_number,
    m.league_is_second_leg,
    mr.team_a_games,
    mr.team_b_games
  FROM public.matches m
  LEFT JOIN public.league_pairs pa ON pa.id = m.league_pair_a_id
  LEFT JOIN public.league_pairs pb ON pb.id = m.league_pair_b_id
  LEFT JOIN LATERAL (
    SELECT r.team_a_games, r.team_b_games
    FROM public.match_results r
    WHERE r.match_id = m.id AND r.status = 'confirmed'
    ORDER BY r.created_at DESC
    LIMIT 1
  ) mr ON TRUE
  WHERE m.league_id = p_league_id
  ORDER BY
    COALESCE(m.league_round_number, 9999),
    m.league_is_second_leg,
    m.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_league_matches(UUID) TO authenticated;
