-- Player ranking positions (global + city) for profile stats card.

CREATE OR REPLACE FUNCTION public.get_player_ranking(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_city TEXT;
  v_city TEXT;
  v_elo INT;
  v_wins INT;
  v_played INT;
  v_global_rank INT;
  v_city_rank INT;
  v_global_total INT;
  v_city_total INT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    NULLIF(BTRIM(pr.city), ''),
    COALESCE(ps.elo_rating, 1200),
    COALESCE(ps.wins, 0),
    COALESCE(ps.matches_played, 0)
  INTO v_profile_city, v_elo, v_wins, v_played
  FROM public.profiles pr
  LEFT JOIN public.player_stats ps ON ps.user_id = pr.id
  WHERE pr.id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile_city IS NOT NULL
     AND lower(v_profile_city) <> lower('Ciudad por definir') THEN
    v_city := v_profile_city;
  ELSE
    SELECT c.city
    INTO v_city
    FROM (
      SELECT
        BTRIM(m.city) AS city,
        COUNT(*)::INT AS cnt
      FROM public._player_confirmed_match_rows(p_user_id) m
      WHERE NULLIF(BTRIM(m.city), '') IS NOT NULL
        AND lower(BTRIM(m.city)) <> lower('Ciudad por definir')
      GROUP BY BTRIM(m.city)
      ORDER BY COUNT(*) DESC, BTRIM(m.city) ASC
      LIMIT 1
    ) c;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_global_total
  FROM public.player_stats ps
  WHERE ps.matches_played > 0;

  IF v_city IS NOT NULL THEN
    SELECT COUNT(*)::INT
    INTO v_city_total
    FROM public.player_stats ps
    JOIN public.profiles pr ON pr.id = ps.user_id
    WHERE ps.matches_played > 0
      AND (pr.city ILIKE v_city OR ps.user_id = p_user_id);
  END IF;

  IF v_played <= 0 THEN
    RETURN jsonb_build_object(
      'user_id', p_user_id,
      'city', v_city,
      'elo_rating', v_elo,
      'global_rank', NULL,
      'city_rank', NULL,
      'global_total', v_global_total,
      'city_total', v_city_total
    );
  END IF;

  SELECT COUNT(*)::INT + 1
  INTO v_global_rank
  FROM public.player_stats ps
  WHERE ps.matches_played > 0
    AND (
      ps.elo_rating > v_elo
      OR (ps.elo_rating = v_elo AND ps.wins > v_wins)
      OR (ps.elo_rating = v_elo AND ps.wins = v_wins AND ps.matches_played > v_played)
      OR (
        ps.elo_rating = v_elo
        AND ps.wins = v_wins
        AND ps.matches_played = v_played
        AND ps.user_id::TEXT < p_user_id::TEXT
      )
    );

  IF v_city IS NOT NULL THEN
    SELECT COUNT(*)::INT + 1
    INTO v_city_rank
    FROM public.player_stats ps
    JOIN public.profiles pr ON pr.id = ps.user_id
    WHERE ps.matches_played > 0
      AND (pr.city ILIKE v_city OR ps.user_id = p_user_id)
      AND (
        ps.elo_rating > v_elo
        OR (ps.elo_rating = v_elo AND ps.wins > v_wins)
        OR (ps.elo_rating = v_elo AND ps.wins = v_wins AND ps.matches_played > v_played)
        OR (
          ps.elo_rating = v_elo
          AND ps.wins = v_wins
          AND ps.matches_played = v_played
          AND ps.user_id::TEXT < p_user_id::TEXT
        )
      );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'city', v_city,
    'elo_rating', v_elo,
    'global_rank', v_global_rank,
    'city_rank', v_city_rank,
    'global_total', v_global_total,
    'city_total', v_city_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_ranking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_ranking(UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
