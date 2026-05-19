-- Migration 020: Admin analytics RPCs (admin role required)

CREATE OR REPLACE FUNCTION public.admin_assert_is_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assert_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assert_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_analytics()
RETURNS TABLE (
  mau BIGINT,
  total_matches BIGINT,
  matches_this_week BIGINT,
  pct_confirmed NUMERIC,
  pct_disputed NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_results BIGINT;
  v_confirmed BIGINT;
  v_disputed BIGINT;
BEGIN
  PERFORM public.admin_assert_is_admin();

  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'confirmed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'disputed')::BIGINT
  INTO v_total_results, v_confirmed, v_disputed
  FROM public.match_results;

  RETURN QUERY
  SELECT
    (
      SELECT COUNT(DISTINCT mp.user_id)::BIGINT
      FROM public.match_participants mp
      WHERE mp.state = 'confirmed'
        AND mp.joined_at >= NOW() - INTERVAL '30 days'
    ),
    (SELECT COUNT(*)::BIGINT FROM public.matches),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.matches m
      WHERE m.created_at >= date_trunc('week', NOW())
    ),
    CASE
      WHEN v_total_results > 0 THEN ROUND((v_confirmed::NUMERIC / v_total_results) * 100, 1)
      ELSE 0::NUMERIC
    END,
    CASE
      WHEN v_total_results > 0 THEN ROUND((v_disputed::NUMERIC / v_total_results) * 100, 1)
      ELSE 0::NUMERIC
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_analytics() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_matches_by_week(p_weeks INT DEFAULT 12)
RETURNS TABLE (week_start DATE, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_is_admin();

  RETURN QUERY
  SELECT
    d.week_start::DATE,
    COUNT(m.id)::BIGINT AS count
  FROM (
    SELECT (date_trunc('week', NOW())::DATE - (n || ' weeks')::INTERVAL)::DATE AS week_start
    FROM generate_series(0, GREATEST(p_weeks, 1) - 1) AS n
  ) d
  LEFT JOIN public.matches m
    ON date_trunc('week', m.created_at)::DATE = d.week_start
  GROUP BY d.week_start
  ORDER BY d.week_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_matches_by_week(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_matches_by_city(p_lim INT DEFAULT 10)
RETURNS TABLE (city TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_is_admin();

  RETURN QUERY
  SELECT m.city, COUNT(*)::BIGINT
  FROM public.matches m
  WHERE m.city IS NOT NULL AND m.city <> ''
  GROUP BY m.city
  ORDER BY COUNT(*) DESC
  LIMIT GREATEST(p_lim, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_matches_by_city(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user_ranking(p_lim INT DEFAULT 20)
RETURNS TABLE (user_id UUID, display_name TEXT, match_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_is_admin();

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    COUNT(mp.id)::BIGINT
  FROM public.profiles p
  JOIN public.match_participants mp
    ON mp.user_id = p.id
   AND mp.state = 'confirmed'
  GROUP BY p.id, p.display_name
  ORDER BY COUNT(mp.id) DESC
  LIMIT GREATEST(p_lim, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_ranking(INT) TO authenticated;
