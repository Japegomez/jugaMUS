-- 088: Fix league/tournament pair member display names.
--   - profiles RLS: allow reading display_name of pair members in leagues/tournaments you can read.
--   - profile_is_viewable_by_auth / get_public_profile: include league pairs.
--   - add_league_pair / join_league_pair: use display_name (not 'Jugador') when generating the auto pair name.

-- ── profiles SELECT policy for league/tournament pair members ─────────────────

CREATE POLICY profiles_select_pair_member ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.league_pairs lp
      WHERE public.auth_can_read_league(lp.league_id)
        AND (lp.player_a_user_id = profiles.id OR lp.player_b_user_id = profiles.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_pairs tp
      WHERE public.auth_can_read_tournament(tp.tournament_id)
        AND (tp.player_a_user_id = profiles.id OR tp.player_b_user_id = profiles.id)
    )
  );

-- ── profile_is_viewable_by_auth: include league pairs ──────────────────────────

CREATE OR REPLACE FUNCTION public.profile_is_viewable_by_auth(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND (
        p.id = auth.uid()
        OR public.profile_shares_confirmed_match_with_auth(p.id)
        OR EXISTS (
          SELECT 1
          FROM public.tournament_pairs tp
          WHERE tp.tournament_id IS NOT NULL
            AND public.auth_can_read_tournament(tp.tournament_id)
            AND (tp.player_a_user_id = p.id OR tp.player_b_user_id = p.id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.league_pairs lp
          WHERE public.auth_can_read_league(lp.league_id)
            AND (lp.player_a_user_id = p.id OR lp.player_b_user_id = p.id)
        )
        OR public.auth_is_admin()
      )
  );
$$;

-- ── get_public_profile: include league pairs ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_profile(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  photo_url TEXT,
  city TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.display_name, p.photo_url, p.city
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND (
      p.id = auth.uid()
      OR public.profile_shares_confirmed_match_with_auth(p.id)
      OR EXISTS (
        SELECT 1
        FROM public.tournament_pairs tp
        WHERE tp.tournament_id IS NOT NULL
          AND public.auth_can_read_tournament(tp.tournament_id)
          AND (tp.player_a_user_id = p.id OR tp.player_b_user_id = p.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.league_pairs lp
        WHERE public.auth_can_read_league(lp.league_id)
          AND (lp.player_a_user_id = p.id OR lp.player_b_user_id = p.id)
      )
      OR public.auth_is_admin()
    );
$$;

-- ── helper: resolve display label for a pair slot ─────────────────────────────

CREATE OR REPLACE FUNCTION public.league_pair_slot_label(
  p_user_id UUID,
  p_text TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(COALESCE(p_text, '')), ''),
    (SELECT display_name FROM public.profiles WHERE id = p_user_id),
    'Jugador'
  );
$$;

-- ── add_league_pair: use display_name for auto-generated pair name ─────────────

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
  v_a_label TEXT;
  v_b_label TEXT;
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
    v_a_label := public.league_pair_slot_label(p_player_a_user_id, v_a_text);
    v_b_label := public.league_pair_slot_label(p_player_b_user_id, v_b_text);
    v_name := v_a_label || ' - ' || v_b_label;
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

-- ── join_league_pair: regenerate non-custom pair name when a user joins ───────

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
  v_a_label TEXT;
  v_b_label TEXT;
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

  -- Regenerate auto pair name when not custom so it reflects the new member.
  IF NOT v_pair.name_is_custom THEN
    v_a_label := public.league_pair_slot_label(v_pair.player_a_user_id, v_pair.player_a_text);
    v_b_label := public.league_pair_slot_label(v_pair.player_b_user_id, v_pair.player_b_text);
    UPDATE public.league_pairs
    SET name = v_a_label || ' - ' || v_b_label
    WHERE id = p_pair_id;
    SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id;
  END IF;

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
