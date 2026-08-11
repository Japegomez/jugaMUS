-- 103: Recalcular ELO + agregados/logros al leer get_player_stats
-- Rebuild de ELO solo del usuario (no muta rivales). Usa el ELO actual de
-- oponentes/compañeros como aproximación histórica.

CREATE OR REPLACE FUNCTION public.rebuild_player_elo(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_team_a UUID[];
  v_team_b UUID[];
  v_elo_a NUMERIC;
  v_elo_b NUMERIC;
  v_expected_a NUMERIC;
  v_score_a NUMERIC;
  v_delta NUMERIC;
  v_running INT := 1200;
  v_uid UUID;
  k CONSTANT NUMERIC := 32;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.ensure_player_stats_row(p_user_id);

  UPDATE public.player_stats
  SET elo_rating = 1200, updated_at = NOW()
  WHERE user_id = p_user_id;

  FOR r IN
    SELECT match_id, team, team_a_games, team_b_games
    FROM public._player_confirmed_match_rows(p_user_id)
  LOOP
    IF r.team_a_games = r.team_b_games THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
    INTO v_team_a
    FROM public.match_participants mp
    WHERE mp.match_id = r.match_id AND mp.state = 'confirmed' AND mp.team = 'A';

    SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
    INTO v_team_b
    FROM public.match_participants mp
    WHERE mp.match_id = r.match_id AND mp.state = 'confirmed' AND mp.team = 'B';

    -- Sin rivales con cuenta no hay cambio de ELO (igual que apply_match_elo)
    IF cardinality(v_team_a) = 0 OR cardinality(v_team_b) = 0 THEN
      CONTINUE;
    END IF;

    FOREACH v_uid IN ARRAY (v_team_a || v_team_b)
    LOOP
      PERFORM public.ensure_player_stats_row(v_uid);
    END LOOP;

    -- El usuario en rebuild usa v_running; rivales/compañeros, su ELO actual
    SELECT AVG(
      CASE WHEN ps.user_id = p_user_id THEN v_running ELSE ps.elo_rating END
    )::NUMERIC
    INTO v_elo_a
    FROM public.player_stats ps
    WHERE ps.user_id = ANY (v_team_a);

    SELECT AVG(
      CASE WHEN ps.user_id = p_user_id THEN v_running ELSE ps.elo_rating END
    )::NUMERIC
    INTO v_elo_b
    FROM public.player_stats ps
    WHERE ps.user_id = ANY (v_team_b);

    v_expected_a := 1.0 / (1.0 + POWER(10.0, (v_elo_b - v_elo_a) / 400.0));
    v_score_a := CASE WHEN r.team_a_games > r.team_b_games THEN 1.0 ELSE 0.0 END;

    IF r.team = 'A' THEN
      v_delta := ROUND(k * (v_score_a - v_expected_a));
    ELSE
      v_delta := ROUND(k * ((1.0 - v_score_a) - (1.0 - v_expected_a)));
    END IF;

    v_running := GREATEST(100, v_running + v_delta::INT);
  END LOOP;

  UPDATE public.player_stats
  SET elo_rating = v_running, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_player_elo(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_player_stats(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_updated TIMESTAMPTZ;
  v_last_confirmed TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Si player_stats ya está al día con el último partido confirmado, evita recalcular
  -- (aproximación de "no recalcular ELO en cada lectura").
  SELECT ps.updated_at
  INTO v_player_updated
  FROM public.player_stats ps
  WHERE ps.user_id = p_user_id;

  SELECT MAX(m.updated_at)
  INTO v_last_confirmed
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.match_results mr
    ON mr.match_id = m.id AND mr.status = 'confirmed'
  WHERE mp.user_id = p_user_id
    AND mp.state = 'confirmed';

  IF v_player_updated IS NOT NULL
     AND v_last_confirmed IS NOT NULL
     AND v_player_updated >= v_last_confirmed
  THEN
    RETURN;
  END IF;

  PERFORM public.rebuild_player_elo(p_user_id);
  PERFORM public.recompute_player_stats_aggregates(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_player_stats(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.refresh_player_stats(UUID) IS
  'Recalcula ELO (solo ese usuario), agregados y logros. Se invoca desde get_player_stats.';

-- Re-declare get_player_stats in a readable way:
-- it calls refresh_player_stats directly, instead of relying on a fragile
-- pg_get_functiondef text rewrite.
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
  v_t_part INT;
  v_win_rate NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.refresh_player_stats(p_user_id);
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

  -- Rivalries: aggregate vs each opponent on the other team
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

  SELECT COUNT(DISTINCT m.tournament_id)::INT
  INTO v_t_part
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  WHERE mp.user_id = p_user_id
    AND mp.state = 'confirmed'
    AND m.tournament_id IS NOT NULL;

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

NOTIFY pgrst, 'reload schema';
