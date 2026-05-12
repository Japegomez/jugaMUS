-- RPC for F5 Descubrir: list public matches with slot counts (RLS hides participants for non-members).
-- SECURITY DEFINER: only returns rows where visibility = 'public'.

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
      m.place_text,
      m.duration_target_games,
      m.visibility,
      m.location_privacy,
      m.status,
      m.creator_id,
      m.created_at,
      m.updated_at,
      (
        SELECT COUNT(*)::integer
        FROM public.match_participants mp
        WHERE mp.match_id = m.id
          AND mp.state = 'confirmed'
          AND mp.left_at IS NULL
      ) AS slots_filled
    FROM public.matches m
    WHERE m.visibility = 'public'
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

REVOKE ALL ON FUNCTION public.list_public_matches(
  text, text, text, timestamptz, timestamptz, integer, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_public_matches(
  text, text, text, timestamptz, timestamptz, integer, integer, integer
) TO authenticated;
