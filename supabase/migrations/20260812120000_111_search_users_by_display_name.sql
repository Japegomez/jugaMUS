-- 111: Search active users by display name for friend requests.
-- Returns limited public fields + friendship status with the caller.
-- SECURITY DEFINER because profiles RLS does not allow browsing all users.

CREATE OR REPLACE FUNCTION public.search_users_by_display_name(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  city TEXT,
  photo_url TEXT,
  friendship_status TEXT,
  friendship_direction TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self UUID := auth.uid();
  v_q TEXT := NULLIF(BTRIM(COALESCE(p_query, '')), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 30);
BEGIN
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_q IS NULL OR char_length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.city,
    p.photo_url,
    f.status AS friendship_status,
    CASE
      WHEN f.id IS NULL THEN NULL
      WHEN f.requester_id = v_self THEN 'sent'
      WHEN f.addressee_id = v_self THEN 'received'
      ELSE NULL
    END AS friendship_direction
  FROM public.profiles p
  LEFT JOIN public.friendships f
    ON f.status IN ('pending', 'accepted')
   AND LEAST(f.requester_id, f.addressee_id) = LEAST(v_self, p.id)
   AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_self, p.id)
  WHERE p.status = 'active'
    AND p.id <> v_self
    AND p.display_name ILIKE '%' || v_q || '%'
  ORDER BY
    CASE WHEN lower(p.display_name) = lower(v_q) THEN 0 ELSE 1 END,
    p.display_name
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users_by_display_name(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_by_display_name(TEXT, INT) TO authenticated;
