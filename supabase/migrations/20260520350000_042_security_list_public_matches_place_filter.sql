-- 042: Mask exact location in explore when location_privacy = participants_only.

CREATE OR REPLACE FUNCTION public.list_public_matches(
  p_search text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_start_after timestamptz DEFAULT NULL,
  p_start_before timestamptz DEFAULT NULL,
  p_min_free_slots integer DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  start_at timestamptz,
  city text,
  place_defined boolean,
  place_text text,
  duration_target_games integer,
  visibility text,
  location_privacy text,
  status text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  slots_filled integer,
  free_slots integer,
  total_count bigint
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
    WHERE m.visibility = 'public'
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
      AND (p_start_after IS NULL OR m.start_at >= p_start_after)
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
