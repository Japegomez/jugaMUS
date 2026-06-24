-- 066: Replace link-only visibility with password-protected private matches.
-- Private matches appear in the explore list; joining requires the correct password.

-- 1. Enable pgcrypto (no-op if already enabled).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add password_hash column and extend the visibility constraint.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_visibility_check,
  ADD CONSTRAINT matches_visibility_check
    CHECK (visibility IN ('public', 'link', 'private'));

-- 3. matches_select: private rows are readable by all authenticated users (appear in explore).
DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated USING (
    visibility IN ('public', 'private')
    OR creator_id = auth.uid()
    OR public.auth_is_confirmed_in_match(id)
    OR visibility = 'link'
    OR (
      tournament_id IS NOT NULL
      AND public.auth_can_read_tournament(tournament_id)
    )
  );

-- 4. participants_insert_self: allow joining private matches (password verified in RPC).
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
        AND m.visibility IN ('public', 'link', 'private')
        AND m.tournament_id IS NULL
    )
  );

-- 5. set_match_password: creator sets or updates the match password (hashed with bcrypt).
CREATE OR REPLACE FUNCTION public.set_match_password(
  p_match_id UUID,
  p_password  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_password), '') IS NULL THEN
    RAISE EXCEPTION 'password_empty';
  END IF;

  UPDATE public.matches
  SET
    password_hash = crypt(p_password, gen_salt('bf', 10)),
    updated_at = NOW()
  WHERE id = p_match_id
    AND creator_id = auth.uid()
    AND visibility = 'private';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_password(UUID, TEXT) TO authenticated;

-- 6. join_private_match: verify password then join atomically.
CREATE OR REPLACE FUNCTION public.join_private_match(
  p_match_id UUID,
  p_team      TEXT,
  p_password  TEXT
)
RETURNS public.match_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_match   public.matches%ROWTYPE;
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

  IF v_match.password_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_match.password_hash) <> v_match.password_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  -- Re-activate or insert participant.
  SELECT * INTO v_existing
  FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existing.left_at IS NULL AND v_existing.state = 'confirmed' THEN
      RAISE EXCEPTION 'already_participant';
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
    INSERT INTO public.match_participants (match_id, user_id, team)
    VALUES (p_match_id, auth.uid(), p_team)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) TO authenticated;

-- 7. list_public_matches: add optional p_visibility filter; include private by default.
CREATE OR REPLACE FUNCTION public.list_public_matches(
  p_search       text DEFAULT NULL,
  p_city         text DEFAULT NULL,
  p_status       text DEFAULT NULL,
  p_start_after  timestamptz DEFAULT NULL,
  p_start_before timestamptz DEFAULT NULL,
  p_min_free_slots integer DEFAULT NULL,
  p_limit        integer DEFAULT 20,
  p_offset       integer DEFAULT 0,
  p_visibility   text DEFAULT NULL   -- NULL = all (public+private), 'public', 'private'
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  description           text,
  start_at              timestamptz,
  city                  text,
  place_defined         boolean,
  place_text            text,
  duration_target_games integer,
  visibility            text,
  location_privacy      text,
  status                text,
  creator_id            uuid,
  created_at            timestamptz,
  updated_at            timestamptz,
  slots_filled          integer,
  free_slots            integer,
  total_count           bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      m.id,
      m.title,
      m.description,
      m.start_at,
      m.city,
      m.place_defined,
      CASE
        WHEN m.location_privacy = 'participants_only'
          AND m.creator_id <> auth.uid()
          AND NOT public.auth_is_confirmed_in_match(m.id)
          THEN NULL
        ELSE m.place_text
      END AS place_text,
      m.duration_target_games,
      m.visibility,
      m.location_privacy,
      m.status,
      m.creator_id,
      m.created_at,
      m.updated_at,
      public.match_effective_roster_filled(m.id) AS slots_filled
    FROM public.matches m
    WHERE m.visibility IN ('public', 'private')
      AND (p_visibility IS NULL OR m.visibility = p_visibility)
      AND m.status <> 'cancelled'
      AND m.tournament_id IS NULL
      AND (
        p_search IS NULL
        OR TRIM(p_search) = ''
        OR m.title ILIKE ('%' || TRIM(p_search) || '%')
      )
      AND (
        p_city IS NULL
        OR TRIM(p_city) = ''
        OR m.city = TRIM(p_city)
      )
      AND (
        p_status IS NULL
        OR TRIM(p_status) = ''
        OR m.status = TRIM(p_status)
      )
      AND (
        p_start_after IS NULL
        OR (
          m.status NOT IN ('finished', 'finished_no_result')
          AND (
            m.start_at >= p_start_after
            OR (
              m.status IN ('planned', 'in_progress')
              AND m.start_at < p_start_after
            )
          )
        )
      )
      AND (p_start_before IS NULL OR m.start_at <= p_start_before)
  ),
  with_free AS (
    SELECT
      f.*,
      (4 - f.slots_filled) AS free_slots
    FROM filtered f
    WHERE (
      p_min_free_slots IS NULL
      OR p_min_free_slots <= 0
      OR (4 - f.slots_filled) >= p_min_free_slots
    )
  )
  SELECT
    w.id,
    w.title,
    w.description,
    w.start_at,
    w.city,
    w.place_defined,
    w.place_text,
    w.duration_target_games,
    w.visibility,
    w.location_privacy,
    w.status,
    w.creator_id,
    w.created_at,
    w.updated_at,
    w.slots_filled,
    w.free_slots,
    COUNT(*) OVER () AS total_count
  FROM with_free w
  ORDER BY w.start_at ASC
  LIMIT LEAST(100, GREATEST(1, COALESCE(NULLIF(p_limit, 0), 20)))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;
