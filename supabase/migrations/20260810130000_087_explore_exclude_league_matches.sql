-- 087: Exclude league fixtures from explore / casual join flows (mirror tournament).

-- list_public_matches: hide league-linked matches
CREATE OR REPLACE FUNCTION public.list_public_matches(
  p_search       text DEFAULT NULL,
  p_city         text DEFAULT NULL,
  p_status       text DEFAULT NULL,
  p_start_after  timestamptz DEFAULT NULL,
  p_start_before timestamptz DEFAULT NULL,
  p_min_free_slots integer DEFAULT NULL,
  p_limit        integer DEFAULT 20,
  p_offset       integer DEFAULT 0,
  p_visibility   text DEFAULT NULL
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
      AND m.league_id IS NULL
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

-- join_private_match: reject league fixtures
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

  IF v_match.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'league_match';
  END IF;

  IF v_match.password_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_match.password_hash) <> v_match.password_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

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

-- Casual join policies: not for league fixtures
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
        AND m.league_id IS NULL
    )
  );
