-- League placement badges in recompute_player_stats_aggregates.
-- Internal helper avoids auth_can_read_league so triggers/backfill work.

CREATE OR REPLACE FUNCTION public._finished_league_ranks_for_user(p_user_id UUID)
RETURNS TABLE (league_id UUID, rank INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH user_pairs AS (
    SELECT lp.id AS pair_id, lp.league_id
    FROM public.league_pairs lp
    JOIN public.leagues l ON l.id = lp.league_id
    WHERE l.status = 'finished'
      AND (lp.player_a_user_id = p_user_id OR lp.player_b_user_id = p_user_id)
  ),
  confirmed AS (
    SELECT
      m.league_id,
      m.league_pair_a_id AS pair_a,
      m.league_pair_b_id AS pair_b,
      mr.team_a_games,
      mr.team_b_games
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE m.league_id IN (SELECT DISTINCT up.league_id FROM user_pairs up)
      AND m.status = 'finished'
      AND m.league_pair_a_id IS NOT NULL
      AND m.league_pair_b_id IS NOT NULL
  ),
  pair_stats AS (
    SELECT
      lp.id AS pair_id,
      lp.league_id,
      COALESCE((
        SELECT COUNT(*)::INT FROM confirmed c
        WHERE c.league_id = lp.league_id
          AND (c.pair_a = lp.id OR c.pair_b = lp.id)
      ), 0) AS played,
      COALESCE((
        SELECT COUNT(*)::INT FROM confirmed c
        WHERE c.league_id = lp.league_id
          AND (
            (c.pair_a = lp.id AND c.team_a_games > c.team_b_games)
            OR (c.pair_b = lp.id AND c.team_b_games > c.team_a_games)
          )
      ), 0) AS wins,
      COALESCE((
        SELECT SUM(
          CASE WHEN c.pair_a = lp.id THEN c.team_a_games ELSE c.team_b_games END
        )::INT
        FROM confirmed c
        WHERE c.league_id = lp.league_id AND (c.pair_a = lp.id OR c.pair_b = lp.id)
      ), 0) AS games_for,
      COALESCE((
        SELECT SUM(
          CASE WHEN c.pair_a = lp.id THEN c.team_b_games ELSE c.team_a_games END
        )::INT
        FROM confirmed c
        WHERE c.league_id = lp.league_id AND (c.pair_a = lp.id OR c.pair_b = lp.id)
      ), 0) AS games_against
    FROM public.league_pairs lp
    WHERE lp.league_id IN (SELECT DISTINCT up.league_id FROM user_pairs up)
  ),
  ranked AS (
    SELECT
      ps.league_id,
      ps.pair_id,
      ROW_NUMBER() OVER (
        PARTITION BY ps.league_id
        ORDER BY ps.wins DESC, (ps.games_for - ps.games_against) DESC, ps.games_for DESC, ps.pair_id
      )::INT AS rank
    FROM pair_stats ps
  )
  SELECT r.league_id, r.rank
  FROM ranked r
  JOIN user_pairs up ON up.pair_id = r.pair_id AND up.league_id = r.league_id;
$$;

REVOKE ALL ON FUNCTION public._finished_league_ranks_for_user(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recompute_player_stats_aggregates(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_played INT := 0;
  v_wins INT := 0;
  v_losses INT := 0;
  v_streak INT := 0;
  v_best INT := 0;
  v_run INT := 0;
  v_won BOOLEAN;
  v_form JSONB := '[]'::jsonb;
  v_form_arr TEXT[] := ARRAY[]::TEXT[];
  v_t_won INT := 0;
  v_t_finals INT := 0;
  v_t_thirds INT := 0;
  v_venues INT := 0;
  v_badges JSONB := '[]'::jsonb;
  v_existing JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_key TEXT;
  v_keys TEXT[];
  v_nemesis_wins INT := 0;
  v_league_gold INT := 0;
  v_league_silver INT := 0;
  v_league_bronze INT := 0;
  v_league_part INT := 0;
BEGIN
  PERFORM public.ensure_player_stats_row(p_user_id);

  FOR r IN
    SELECT * FROM public._player_confirmed_match_rows(p_user_id)
  LOOP
    v_won := public._player_won_match(r.team, r.team_a_games, r.team_b_games);
    IF v_won IS NULL THEN
      CONTINUE;
    END IF;

    v_played := v_played + 1;
    IF v_won THEN
      v_wins := v_wins + 1;
      IF v_run >= 0 THEN
        v_run := v_run + 1;
      ELSE
        v_run := 1;
      END IF;
      IF v_run > v_best THEN
        v_best := v_run;
      END IF;
      v_form_arr := array_append(v_form_arr, 'won');
    ELSE
      v_losses := v_losses + 1;
      IF v_run <= 0 THEN
        v_run := v_run - 1;
      ELSE
        v_run := -1;
      END IF;
      v_form_arr := array_append(v_form_arr, 'lost');
    END IF;

    IF r.tournament_id IS NOT NULL
       AND r.tournament_round_size = 2
       AND NOT r.tournament_is_third_place THEN
      v_t_finals := v_t_finals + 1;
      IF r.tournament_winner_pair_id IS NOT NULL
         AND (
           (r.team = 'A' AND r.tournament_winner_pair_id = r.tournament_pair_a_id)
           OR (r.team = 'B' AND r.tournament_winner_pair_id = r.tournament_pair_b_id)
         ) THEN
        v_t_won := v_t_won + 1;
      END IF;
    END IF;

    IF r.tournament_id IS NOT NULL
       AND r.tournament_is_third_place
       AND r.tournament_winner_pair_id IS NOT NULL
       AND (
         (r.team = 'A' AND r.tournament_winner_pair_id = r.tournament_pair_a_id)
         OR (r.team = 'B' AND r.tournament_winner_pair_id = r.tournament_pair_b_id)
       ) THEN
      v_t_thirds := v_t_thirds + 1;
    END IF;
  END LOOP;

  v_streak := v_run;

  IF cardinality(v_form_arr) > 5 THEN
    v_form_arr := v_form_arr[(cardinality(v_form_arr) - 4):cardinality(v_form_arr)];
  END IF;
  v_form := to_jsonb(v_form_arr);

  SELECT COUNT(DISTINCT (city || '|' || COALESCE(place_text, '')))::INT
  INTO v_venues
  FROM public._player_confirmed_match_rows(p_user_id);

  SELECT COALESCE(MAX(cnt), 0)::INT INTO v_nemesis_wins
  FROM (
    SELECT opp.user_id, COUNT(*)::INT AS cnt
    FROM public.match_participants me
    JOIN public.match_participants opp
      ON opp.match_id = me.match_id
     AND opp.user_id <> me.user_id
     AND opp.team <> me.team
     AND opp.state = 'confirmed'
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE me.user_id = p_user_id
      AND me.state = 'confirmed'
      AND m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS TRUE
    GROUP BY opp.user_id
  ) s;

  SELECT
    COUNT(*) FILTER (WHERE lr.rank = 1)::INT,
    COUNT(*) FILTER (WHERE lr.rank = 2)::INT,
    COUNT(*) FILTER (WHERE lr.rank = 3)::INT,
    COUNT(*)::INT
  INTO v_league_gold, v_league_silver, v_league_bronze, v_league_part
  FROM public._finished_league_ranks_for_user(p_user_id) lr;

  SELECT badges INTO v_existing FROM public.player_stats WHERE user_id = p_user_id;
  IF v_existing IS NULL THEN
    v_existing := '[]'::jsonb;
  END IF;

  v_keys := ARRAY[]::TEXT[];
  IF v_wins >= 1 THEN v_keys := array_append(v_keys, 'first_win'); END IF;
  IF v_wins >= 10 THEN v_keys := array_append(v_keys, 'wins_10'); END IF;
  IF v_wins >= 25 THEN v_keys := array_append(v_keys, 'wins_25'); END IF;
  IF v_wins >= 50 THEN v_keys := array_append(v_keys, 'wins_50'); END IF;
  IF v_wins >= 100 THEN v_keys := array_append(v_keys, 'wins_100'); END IF;
  IF v_t_won >= 1 THEN v_keys := array_append(v_keys, 'tournament_winner'); END IF;
  IF v_t_finals >= 1 THEN v_keys := array_append(v_keys, 'tournament_finalist'); END IF;
  IF v_league_gold >= 1 THEN v_keys := array_append(v_keys, 'league_winner'); END IF;
  IF v_league_silver >= 1 THEN v_keys := array_append(v_keys, 'league_runner_up'); END IF;
  IF (v_league_gold + v_league_silver + v_league_bronze) >= 1 THEN
    v_keys := array_append(v_keys, 'league_podium');
  END IF;
  IF v_league_part >= 3 THEN v_keys := array_append(v_keys, 'league_regular'); END IF;
  IF v_best >= 5 THEN v_keys := array_append(v_keys, 'streak_5'); END IF;
  IF v_best >= 10 THEN v_keys := array_append(v_keys, 'streak_10'); END IF;
  IF v_played >= 50 THEN v_keys := array_append(v_keys, 'veteran_50'); END IF;
  IF v_played >= 100 THEN v_keys := array_append(v_keys, 'veteran_100'); END IF;
  IF v_venues >= 5 THEN v_keys := array_append(v_keys, 'explorer_5'); END IF;
  IF v_nemesis_wins >= 5 THEN v_keys := array_append(v_keys, 'nemesis_confirmed'); END IF;

  v_badges := '[]'::jsonb;
  FOREACH v_key IN ARRAY v_keys
  LOOP
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_existing) e
      WHERE e->>'key' = v_key
    ) THEN
      v_badges := v_badges || (
        SELECT e FROM jsonb_array_elements(v_existing) e WHERE e->>'key' = v_key LIMIT 1
      );
    ELSE
      v_badges := v_badges || jsonb_build_array(
        jsonb_build_object('key', v_key, 'earned_at', v_now)
      );
    END IF;
  END LOOP;

  UPDATE public.player_stats
  SET
    matches_played = v_played,
    wins = v_wins,
    losses = v_losses,
    current_streak = v_streak,
    best_win_streak = v_best,
    tournaments_won = v_t_won,
    tournament_finals = v_t_finals,
    tournament_thirds = v_t_thirds,
    last_form = v_form,
    badges = v_badges,
    updated_at = v_now
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_player_stats_aggregates(UUID) FROM PUBLIC;

-- Refresh badges for existing players.
DO $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN SELECT user_id FROM public.player_stats
  LOOP
    PERFORM public.recompute_player_stats_aggregates(v_uid);
  END LOOP;
END;
$$;
