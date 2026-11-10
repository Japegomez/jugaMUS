-- 124: Move entity password hashes to private schema (Strix vuln-0009).
-- PostgREST does not expose `private`, so select('*') on matches/tournaments/leagues
-- no longer leaks bcrypt verifiers. Redefines the 7 password RPCs against the new table.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.entity_password_hashes (
  scope         TEXT NOT NULL CHECK (scope IN ('match', 'tournament', 'league')),
  entity_id     UUID NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, entity_id)
);

REVOKE ALL ON TABLE private.entity_password_hashes FROM PUBLIC;
REVOKE ALL ON TABLE private.entity_password_hashes FROM anon;
REVOKE ALL ON TABLE private.entity_password_hashes FROM authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Migrate existing hashes (ignore nulls)
INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash)
SELECT 'match', id, password_hash
FROM public.matches
WHERE password_hash IS NOT NULL
ON CONFLICT (scope, entity_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      updated_at = NOW();

INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash)
SELECT 'tournament', id, password_hash
FROM public.tournaments
WHERE password_hash IS NOT NULL
ON CONFLICT (scope, entity_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      updated_at = NOW();

INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash)
SELECT 'league', id, password_hash
FROM public.leagues
WHERE password_hash IS NOT NULL
ON CONFLICT (scope, entity_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      updated_at = NOW();

ALTER TABLE public.matches DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.leagues DROP COLUMN IF EXISTS password_hash;

-- ── set_match_password ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_match_password(
  p_match_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_password), '') IS NULL THEN
    RAISE EXCEPTION 'password_empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = p_match_id
      AND creator_id = auth.uid()
      AND visibility = 'private'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash, updated_at)
  VALUES ('match', p_match_id, crypt(p_password, gen_salt('bf', 10)), NOW())
  ON CONFLICT (scope, entity_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_at = NOW();

  UPDATE public.matches
  SET updated_at = NOW()
  WHERE id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_password(UUID, TEXT) TO authenticated;

-- ── join_private_match (latest body from migration 120, private hash lookup) ─
CREATE OR REPLACE FUNCTION public.join_private_match(
  p_match_id UUID,
  p_team      TEXT,
  p_password  TEXT
)
RETURNS public.match_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_match   public.matches%ROWTYPE;
  v_hash    TEXT;
  v_existing public.match_participants%ROWTYPE;
  v_row      public.match_participants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_match';
  END IF;

  IF v_match.status NOT IN ('planned', 'in_progress') THEN
    RAISE EXCEPTION 'match_not_joinable';
  END IF;

  IF v_match.tournament_id IS NOT NULL THEN
    RAISE EXCEPTION 'tournament_match';
  END IF;

  IF v_match.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'league_match';
  END IF;

  SELECT password_hash INTO v_hash
  FROM private.entity_password_hashes
  WHERE scope = 'match' AND entity_id = p_match_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  SELECT * INTO v_existing
  FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existing.left_at IS NULL AND v_existing.state = 'confirmed' THEN
      RAISE EXCEPTION 'already_participant';
    END IF;

    IF NOT public.inviter_team_capacity_available(p_match_id, p_team) THEN
      RAISE EXCEPTION 'team_capacity_exceeded';
    END IF;

    UPDATE public.match_participants
    SET
      team      = p_team,
      state     = 'confirmed',
      left_at   = NULL,
      joined_at = NOW()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    IF NOT public.inviter_team_capacity_available(p_match_id, p_team) THEN
      RAISE EXCEPTION 'team_capacity_exceeded';
    END IF;

    INSERT INTO public.match_participants (match_id, user_id, team)
    VALUES (p_match_id, auth.uid(), p_team)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) TO authenticated;

-- Direct writes must not bypass the password check performed above.
DROP POLICY IF EXISTS participants_insert_self ON public.match_participants;
CREATE POLICY participants_insert_self ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.status IN ('planned', 'in_progress')
        AND m.tournament_id IS NULL
        AND m.league_id IS NULL
        AND (
          m.visibility IN ('public', 'link')
          OR m.creator_id = auth.uid()
          OR (
            m.visibility = 'private'
            AND EXISTS (
              SELECT 1 FROM public.match_password_grants g
              WHERE g.match_id = m.id AND g.user_id = auth.uid()
            )
          )
        )
    )
  );

-- ── grant_match_password_access ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_match_password_access(
  p_match_id UUID,
  p_password TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_hash  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_match';
  END IF;

  SELECT password_hash INTO v_hash
  FROM private.entity_password_hashes
  WHERE scope = 'match' AND entity_id = p_match_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.match_password_grants (match_id, user_id)
  VALUES (p_match_id, auth.uid())
  ON CONFLICT (match_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_match_password_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_match_password_access(UUID, TEXT) TO authenticated;

-- ── set_tournament_password ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_tournament_password(
  p_tournament_id UUID,
  p_password      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_password), '') IS NULL THEN
    RAISE EXCEPTION 'password_empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id
      AND creator_id = auth.uid()
      AND visibility = 'private'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash, updated_at)
  VALUES ('tournament', p_tournament_id, crypt(p_password, gen_salt('bf', 10)), NOW())
  ON CONFLICT (scope, entity_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_at = NOW();

  UPDATE public.tournaments
  SET updated_at = NOW()
  WHERE id = p_tournament_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tournament_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tournament_password(UUID, TEXT) TO authenticated;

-- ── grant_tournament_password_access ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_tournament_password_access(
  p_tournament_id UUID,
  p_password      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_hash       TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF v_tournament.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_tournament';
  END IF;

  SELECT password_hash INTO v_hash
  FROM private.entity_password_hashes
  WHERE scope = 'tournament' AND entity_id = p_tournament_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'tournament_no_password';
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.tournament_password_grants (tournament_id, user_id)
  VALUES (p_tournament_id, auth.uid())
  ON CONFLICT (tournament_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tournament_password_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_tournament_password_access(UUID, TEXT) TO authenticated;

-- ── set_league_password ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_league_password(
  p_league_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NULLIF(BTRIM(p_password), '') IS NULL THEN RAISE EXCEPTION 'password_empty'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND creator_id = auth.uid()
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
      RAISE EXCEPTION 'league_not_found';
    END IF;
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.leagues
  SET visibility = 'private'
  WHERE id = p_league_id
    AND creator_id = auth.uid();

  INSERT INTO private.entity_password_hashes (scope, entity_id, password_hash, updated_at)
  VALUES ('league', p_league_id, crypt(BTRIM(p_password), gen_salt('bf')), NOW())
  ON CONFLICT (scope, entity_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.set_league_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_league_password(UUID, TEXT) TO authenticated;

-- ── grant_league_password_access ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_league_password_access(
  p_league_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_hash TEXT;
  v_vis  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT l.visibility INTO v_vis
  FROM public.leagues l
  WHERE l.id = p_league_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'league_not_found'; END IF;
  IF v_vis <> 'private' THEN RAISE EXCEPTION 'league_not_found'; END IF;

  SELECT password_hash INTO v_hash
  FROM private.entity_password_hashes
  WHERE scope = 'league' AND entity_id = p_league_id;

  IF v_hash IS NULL THEN RAISE EXCEPTION 'league_no_password'; END IF;
  IF v_hash <> crypt(BTRIM(p_password), v_hash) THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.league_password_grants (league_id, user_id)
  VALUES (p_league_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_league_password_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_league_password_access(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
