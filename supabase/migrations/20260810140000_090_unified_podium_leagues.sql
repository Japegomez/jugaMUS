-- Migration 090: Unified podium (tournaments + leagues) in get_player_stats

CREATE OR REPLACE FUNCTION public.get_player_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ps public.player_stats%ROWTYPE;
  v_venues JSONB;
  v_partners JSONB;
  v_nemesis JSONB;
  v_victim JSONB;
  v_most_faced JSONB;
  v_gold JSONB;
  v_silver JSONB;
  v_bronze JSONB;
  v_t_part INT;
  v_leagues_part INT;
  v_win_rate NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_player_stats_row(p_user_id);
  SELECT * INTO v_ps FROM public.player_stats WHERE user_id = p_user_id;

  IF v_ps.matches_played > 0 THEN
    v_win_rate := ROUND((v_ps.wins::NUMERIC / v_ps.matches_played::NUMERIC) * 100, 1);
  ELSE
    v_win_rate := 0;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb)
  INTO v_venues
  FROM (
    SELECT
      city,
      place_text,
      COUNT(*)::INT AS matches,
      COUNT(*) FILTER (
        WHERE public._player_won_match(team, team_a_games, team_b_games) IS TRUE
      )::INT AS wins,
      CASE WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (
            WHERE public._player_won_match(team, team_a_games, team_b_games) IS TRUE
          )::NUMERIC / COUNT(*)::NUMERIC) * 100,
          1
        )
      ELSE 0 END AS win_rate
    FROM public._player_confirmed_match_rows(p_user_id)
    GROUP BY city, place_text
    ORDER BY COUNT(*) DESC, city ASC
    LIMIT 5
  ) v;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
  INTO v_partners
  FROM (
    SELECT
      partner.user_id,
      pr.display_name,
      pr.photo_url,
      COUNT(*)::INT AS matches,
      COUNT(*) FILTER (
        WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS TRUE
      )::INT AS wins,
      CASE WHEN COUNT(*) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (
            WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS TRUE
          )::NUMERIC / COUNT(*)::NUMERIC) * 100,
          1
        )
      ELSE 0 END AS win_rate
    FROM public.match_participants me
    JOIN public.match_participants partner
      ON partner.match_id = me.match_id
     AND partner.user_id <> me.user_id
     AND partner.team = me.team
     AND partner.state = 'confirmed'
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    JOIN public.profiles pr ON pr.id = partner.user_id
    WHERE me.user_id = p_user_id
      AND me.state = 'confirmed'
      AND m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
    GROUP BY partner.user_id, pr.display_name, pr.photo_url
    ORDER BY COUNT(*) DESC, wins DESC
    LIMIT 5
  ) p;

  WITH rival_stats AS (
    SELECT
      opp.user_id,
      pr.display_name,
      pr.photo_url,
      COUNT(*)::INT AS matches,
      COUNT(*) FILTER (
        WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS TRUE
      )::INT AS wins,
      COUNT(*) FILTER (
        WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS FALSE
      )::INT AS losses
    FROM public.match_participants me
    JOIN public.match_participants opp
      ON opp.match_id = me.match_id
     AND opp.user_id <> me.user_id
     AND opp.team <> me.team
     AND opp.state = 'confirmed'
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    JOIN public.profiles pr ON pr.id = opp.user_id
    WHERE me.user_id = p_user_id
      AND me.state = 'confirmed'
      AND m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS NOT NULL
    GROUP BY opp.user_id, pr.display_name, pr.photo_url
  )
  SELECT
    (SELECT row_to_json(x)::jsonb FROM (
      SELECT user_id, display_name, photo_url, matches, wins, losses
      FROM rival_stats WHERE losses > 0 ORDER BY losses DESC, matches DESC LIMIT 1
    ) x),
    (SELECT row_to_json(x)::jsonb FROM (
      SELECT user_id, display_name, photo_url, matches, wins, losses
      FROM rival_stats WHERE wins > 0 ORDER BY wins DESC, matches DESC LIMIT 1
    ) x),
    (SELECT row_to_json(x)::jsonb FROM (
      SELECT user_id, display_name, photo_url, matches, wins, losses
      FROM rival_stats ORDER BY matches DESC, wins DESC LIMIT 1
    ) x)
  INTO v_nemesis, v_victim, v_most_faced;

  -- Unified podium: tournaments + finished leagues (standings rank 1/2/3)
  WITH tm AS (
    SELECT
      m.tournament_id,
      t.title,
      t.start_at,
      m.tournament_round_size,
      COALESCE(m.tournament_is_third_place, FALSE) AS is_third,
      m.tournament_winner_pair_id,
      CASE mp.team
        WHEN 'A' THEN m.tournament_pair_a_id
        ELSE m.tournament_pair_b_id
      END AS user_pair_id,
      public._player_won_match(mp.team, mr.team_a_games, mr.team_b_games) AS won
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE mp.user_id = p_user_id
      AND mp.state = 'confirmed'
      AND m.status = 'finished'
      AND m.tournament_id IS NOT NULL
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
  ),
  tournament_deduped AS (
    SELECT DISTINCT ON (tournament_id, placement)
      tournament_id AS id,
      title,
      start_at,
      placement,
      'tournament'::TEXT AS source
    FROM (
      SELECT
        tournament_id,
        title,
        start_at,
        'gold'::TEXT AS placement
      FROM tm
      WHERE tournament_round_size = 2
        AND NOT is_third
        AND tournament_winner_pair_id IS NOT NULL
        AND user_pair_id IS NOT NULL
        AND user_pair_id = tournament_winner_pair_id
      UNION ALL
      SELECT
        tournament_id,
        title,
        start_at,
        'silver'::TEXT AS placement
      FROM tm
      WHERE tournament_round_size = 2
        AND NOT is_third
        AND tournament_winner_pair_id IS NOT NULL
        AND user_pair_id IS NOT NULL
        AND user_pair_id <> tournament_winner_pair_id
      UNION ALL
      SELECT
        tournament_id,
        title,
        start_at,
        'bronze'::TEXT AS placement
      FROM tm
      WHERE is_third
        AND won IS TRUE
        AND tournament_winner_pair_id IS NOT NULL
        AND user_pair_id IS NOT NULL
        AND user_pair_id = tournament_winner_pair_id
    ) ranked
    ORDER BY tournament_id, placement, start_at DESC
  ),
  league_placements AS (
    SELECT
      l.id,
      l.title,
      l.start_at,
      CASE s.rank
        WHEN 1 THEN 'gold'
        WHEN 2 THEN 'silver'
        WHEN 3 THEN 'bronze'
      END AS placement,
      'league'::TEXT AS source
    FROM public.leagues l
    JOIN public.league_pairs lp ON lp.league_id = l.id
    JOIN public.list_league_standings(l.id) s ON s.pair_id = lp.id
    WHERE l.status = 'finished'
      AND (lp.player_a_user_id = p_user_id OR lp.player_b_user_id = p_user_id)
      AND s.rank BETWEEN 1 AND 3
  ),
  unified AS (
    SELECT id, title, start_at, placement, source FROM tournament_deduped
    UNION ALL
    SELECT id, title, start_at, placement, source FROM league_placements
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(row_to_json(g)::jsonb ORDER BY g.start_at DESC)
       FROM (
         SELECT id, title, start_at, source
         FROM unified WHERE placement = 'gold'
       ) g),
      '[]'::jsonb
    ),
    COALESCE(
      (SELECT jsonb_agg(row_to_json(s)::jsonb ORDER BY s.start_at DESC)
       FROM (
         SELECT id, title, start_at, source
         FROM unified WHERE placement = 'silver'
       ) s),
      '[]'::jsonb
    ),
    COALESCE(
      (SELECT jsonb_agg(row_to_json(b)::jsonb ORDER BY b.start_at DESC)
       FROM (
         SELECT id, title, start_at, source
         FROM unified WHERE placement = 'bronze'
       ) b),
      '[]'::jsonb
    )
  INTO v_gold, v_silver, v_bronze;

  SELECT COUNT(DISTINCT m.tournament_id)::INT
  INTO v_t_part
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  WHERE mp.user_id = p_user_id
    AND mp.state = 'confirmed'
    AND m.tournament_id IS NOT NULL;

  SELECT COUNT(DISTINCT lp.league_id)::INT
  INTO v_leagues_part
  FROM public.league_pairs lp
  WHERE lp.player_a_user_id = p_user_id
     OR lp.player_b_user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'elo_rating', v_ps.elo_rating,
    'matches_played', v_ps.matches_played,
    'wins', v_ps.wins,
    'losses', v_ps.losses,
    'win_rate', v_win_rate,
    'current_streak', v_ps.current_streak,
    'best_win_streak', v_ps.best_win_streak,
    'last_form', v_ps.last_form,
    'badges', v_ps.badges,
    'tournaments_won', v_ps.tournaments_won,
    'tournament_finals', v_ps.tournament_finals,
    'tournament_thirds', v_ps.tournament_thirds,
    'tournaments_participated', COALESCE(v_t_part, 0),
    'leagues_participated', COALESCE(v_leagues_part, 0),
    'podium', jsonb_build_object(
      'gold', COALESCE(v_gold, '[]'::jsonb),
      'silver', COALESCE(v_silver, '[]'::jsonb),
      'bronze', COALESCE(v_bronze, '[]'::jsonb)
    ),
    'venues', COALESCE(v_venues, '[]'::jsonb),
    'partners', COALESCE(v_partners, '[]'::jsonb),
    'rivalries', jsonb_build_object(
      'nemesis', v_nemesis,
      'best_victim', v_victim,
      'most_faced', v_most_faced
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_stats(UUID) TO authenticated;
