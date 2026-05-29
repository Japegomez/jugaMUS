-- 056: View another user's profile (name, city, phone when allowed) and readable match history.

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
        OR public.auth_is_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_viewable_user_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  city TEXT,
  phone_e164 TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.city,
    CASE
      WHEN p.id = auth.uid()
        OR public.profile_shares_confirmed_match_with_auth(p.id)
        OR public.auth_is_admin()
      THEN p.phone_e164
      ELSE NULL
    END AS phone_e164
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND public.profile_is_viewable_by_auth(p.id);
$$;

CREATE OR REPLACE FUNCTION public.list_user_viewable_matches(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  start_at TIMESTAMPTZ,
  city TEXT,
  place_defined BOOLEAN,
  place_text TEXT,
  status TEXT,
  visibility TEXT,
  creator_id UUID,
  user_team TEXT,
  team_a_games INT,
  team_b_games INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_matches AS (
    SELECT m.*
    FROM public.matches m
    WHERE NOT m.tournament_is_bye
      AND public.auth_can_read_match(m.id)
      AND (
        (
          m.creator_id = p_user_id
          AND m.tournament_id IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.match_participants mp
          WHERE mp.match_id = m.id
            AND mp.user_id = p_user_id
            AND mp.left_at IS NULL
            AND mp.state = 'confirmed'
        )
      )
  )
  SELECT
    tm.id,
    tm.title,
    tm.start_at,
    tm.city,
    tm.place_defined,
    tm.place_text,
    tm.status,
    tm.visibility,
    tm.creator_id,
    mp.team::TEXT AS user_team,
    lr.team_a_games,
    lr.team_b_games
  FROM target_matches tm
  LEFT JOIN LATERAL (
    SELECT mp.team
    FROM public.match_participants mp
    WHERE mp.match_id = tm.id
      AND mp.user_id = p_user_id
      AND mp.left_at IS NULL
    LIMIT 1
  ) mp ON TRUE
  LEFT JOIN LATERAL (
    SELECT mr.team_a_games, mr.team_b_games
    FROM public.match_results mr
    WHERE mr.match_id = tm.id
      AND mr.status = 'confirmed'
    ORDER BY mr.created_at DESC
    LIMIT 1
  ) lr ON TRUE
  WHERE public.profile_is_viewable_by_auth(p_user_id)
  ORDER BY tm.start_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.profile_is_viewable_by_auth(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_viewable_by_auth(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_viewable_user_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewable_user_profile(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.list_user_viewable_matches(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_viewable_matches(UUID) TO authenticated;
