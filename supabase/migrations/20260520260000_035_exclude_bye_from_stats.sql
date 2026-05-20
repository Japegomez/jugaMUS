-- 035: Exclude tournament bye matches from history and analytics.

CREATE OR REPLACE FUNCTION public.list_matches_awaiting_my_result_action()
RETURNS TABLE (
  id uuid,
  title text,
  start_at timestamptz,
  city text,
  status text,
  visibility text,
  creator_id uuid,
  match_result_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.id)
    m.id,
    m.title,
    m.start_at,
    m.city,
    m.status,
    m.visibility,
    m.creator_id,
    mr.id AS match_result_id
  FROM public.matches m
  INNER JOIN public.match_participants mp
    ON mp.match_id = m.id
   AND mp.user_id = auth.uid()
   AND mp.state = 'confirmed'
   AND mp.left_at IS NULL
  INNER JOIN public.match_results mr ON mr.match_id = m.id
  WHERE mr.status = 'pending_validation'
    AND mr.submitted_by_team <> mp.team
    AND NOT COALESCE(m.tournament_is_bye, FALSE)
    AND NOT EXISTS (
      SELECT 1
      FROM public.result_confirmations rc
      WHERE rc.match_result_id = mr.id
        AND rc.user_id = auth.uid()
    )
  ORDER BY m.id, mr.created_at DESC;
$$;

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
SET search_path = public
AS $$
DECLARE
  v_total_results BIGINT;
  v_confirmed BIGINT;
  v_disputed BIGINT;
BEGIN
  PERFORM public.admin_assert_is_admin();

  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE mr.status = 'confirmed')::BIGINT,
    COUNT(*) FILTER (WHERE mr.status = 'disputed')::BIGINT
  INTO v_total_results, v_confirmed, v_disputed
  FROM public.match_results mr
  INNER JOIN public.matches m ON m.id = mr.match_id
  WHERE NOT COALESCE(m.tournament_is_bye, FALSE);

  RETURN QUERY
  SELECT
    (
      SELECT COUNT(DISTINCT mp.user_id)::BIGINT
      FROM public.match_participants mp
      INNER JOIN public.matches m ON m.id = mp.match_id
      WHERE mp.state = 'confirmed'
        AND mp.joined_at >= NOW() - INTERVAL '30 days'
        AND NOT COALESCE(m.tournament_is_bye, FALSE)
    ),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.matches m
      WHERE NOT COALESCE(m.tournament_is_bye, FALSE)
    ),
    (
      SELECT COUNT(*)::BIGINT
      FROM public.matches m
      WHERE NOT COALESCE(m.tournament_is_bye, FALSE)
        AND m.created_at >= date_trunc('week', NOW())
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

CREATE OR REPLACE FUNCTION public.admin_get_matches_by_week(p_weeks INT DEFAULT 12)
RETURNS TABLE (week_start DATE, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
   AND NOT COALESCE(m.tournament_is_bye, FALSE)
  GROUP BY d.week_start
  ORDER BY d.week_start ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_matches_by_city(p_lim INT DEFAULT 10)
RETURNS TABLE (city TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_is_admin();

  RETURN QUERY
  SELECT m.city, COUNT(*)::BIGINT
  FROM public.matches m
  WHERE m.city IS NOT NULL
    AND m.city <> ''
    AND NOT COALESCE(m.tournament_is_bye, FALSE)
  GROUP BY m.city
  ORDER BY COUNT(*) DESC
  LIMIT GREATEST(p_lim, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_ranking(p_lim INT DEFAULT 20)
RETURNS TABLE (user_id UUID, display_name TEXT, match_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  JOIN public.matches m
    ON m.id = mp.match_id
   AND NOT COALESCE(m.tournament_is_bye, FALSE)
  GROUP BY p.id, p.display_name
  ORDER BY COUNT(mp.id) DESC
  LIMIT GREATEST(p_lim, 1);
END;
$$;
