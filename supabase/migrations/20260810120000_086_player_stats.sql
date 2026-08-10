-- Migration 086: Player statistics, ELO, H2H insights, leaderboard

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  elo_rating INT NOT NULL DEFAULT 1200,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_win_streak INT NOT NULL DEFAULT 0,
  tournaments_won INT NOT NULL DEFAULT 0,
  tournament_finals INT NOT NULL DEFAULT 0,
  tournament_thirds INT NOT NULL DEFAULT 0,
  last_form JSONB NOT NULL DEFAULT '[]'::jsonb,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_stats_select_authenticated ON public.player_stats;
CREATE POLICY player_stats_select_authenticated
  ON public.player_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated — only SECURITY DEFINER writes.

CREATE INDEX IF NOT EXISTS player_stats_elo_rating_idx
  ON public.player_stats (elo_rating DESC);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_player_stats_row(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.player_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_player_stats_row(UUID) FROM PUBLIC;

-- Confirmed finished matches for a user (no byes).
CREATE OR REPLACE FUNCTION public._player_confirmed_match_rows(p_user_id UUID)
RETURNS TABLE (
  match_id UUID,
  start_at TIMESTAMPTZ,
  team TEXT,
  team_a_games INT,
  team_b_games INT,
  city TEXT,
  place_text TEXT,
  tournament_id UUID,
  tournament_round_size INT,
  tournament_is_third_place BOOLEAN,
  tournament_winner_pair_id UUID,
  tournament_pair_a_id UUID,
  tournament_pair_b_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    m.id AS match_id,
    m.start_at,
    mp.team,
    mr.team_a_games,
    mr.team_b_games,
    m.city,
    m.place_text,
    m.tournament_id,
    m.tournament_round_size,
    COALESCE(m.tournament_is_third_place, FALSE) AS tournament_is_third_place,
    m.tournament_winner_pair_id,
    m.tournament_pair_a_id,
    m.tournament_pair_b_id
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
  WHERE mp.user_id = p_user_id
    AND mp.state = 'confirmed'
    AND m.status = 'finished'
    AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
  ORDER BY m.start_at ASC, m.id ASC;
$$;

REVOKE ALL ON FUNCTION public._player_confirmed_match_rows(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._player_won_match(
  p_team TEXT,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_team_a_games = p_team_b_games THEN NULL
    WHEN p_team = 'A' THEN p_team_a_games > p_team_b_games
    ELSE p_team_b_games > p_team_a_games
  END;
$$;

REVOKE ALL ON FUNCTION public._player_won_match(TEXT, INT, INT) FROM PUBLIC;

-- Rebuild non-ELO aggregates + badges for one user from full history.
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

    -- Tournament finals (round_size=2, not third-place match)
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

    -- Third place wins
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

  -- Best individual H2H wins vs a single rival (for nemesis_confirmed badge)
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

-- Apply ELO delta for one confirmed match (team avg, K=32).
CREATE OR REPLACE FUNCTION public.apply_match_elo(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_result public.match_results%ROWTYPE;
  v_team_a UUID[];
  v_team_b UUID[];
  v_elo_a NUMERIC;
  v_elo_b NUMERIC;
  v_expected_a NUMERIC;
  v_score_a NUMERIC;
  v_delta_a NUMERIC;
  v_delta_b NUMERIC;
  v_uid UUID;
  k CONSTANT NUMERIC := 32;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_match.status <> 'finished' OR COALESCE(v_match.tournament_is_bye, FALSE) THEN
    RETURN;
  END IF;

  SELECT * INTO v_result
  FROM public.match_results
  WHERE match_id = p_match_id AND status = 'confirmed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_result.team_a_games = v_result.team_b_games THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
  INTO v_team_a
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id AND mp.state = 'confirmed' AND mp.team = 'A';

  SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
  INTO v_team_b
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id AND mp.state = 'confirmed' AND mp.team = 'B';

  IF cardinality(v_team_a) = 0 OR cardinality(v_team_b) = 0 THEN
    RETURN;
  END IF;

  FOREACH v_uid IN ARRAY (v_team_a || v_team_b)
  LOOP
    PERFORM public.ensure_player_stats_row(v_uid);
  END LOOP;

  SELECT AVG(ps.elo_rating)::NUMERIC INTO v_elo_a
  FROM public.player_stats ps WHERE ps.user_id = ANY (v_team_a);

  SELECT AVG(ps.elo_rating)::NUMERIC INTO v_elo_b
  FROM public.player_stats ps WHERE ps.user_id = ANY (v_team_b);

  v_expected_a := 1.0 / (1.0 + POWER(10.0, (v_elo_b - v_elo_a) / 400.0));
  v_score_a := CASE WHEN v_result.team_a_games > v_result.team_b_games THEN 1.0 ELSE 0.0 END;
  v_delta_a := ROUND(k * (v_score_a - v_expected_a));
  v_delta_b := -v_delta_a;

  FOREACH v_uid IN ARRAY v_team_a
  LOOP
    UPDATE public.player_stats
    SET elo_rating = GREATEST(100, elo_rating + v_delta_a::INT), updated_at = NOW()
    WHERE user_id = v_uid;
  END LOOP;

  FOREACH v_uid IN ARRAY v_team_b
  LOOP
    UPDATE public.player_stats
    SET elo_rating = GREATEST(100, elo_rating + v_delta_b::INT), updated_at = NOW()
    WHERE user_id = v_uid;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_match_elo(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recompute_player_stats_for_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE m.id = p_match_id
      AND m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
  ) THEN
    RETURN;
  END IF;

  -- ELO first (uses pre-recompute ratings), then full aggregate rebuild.
  PERFORM public.apply_match_elo(p_match_id);

  FOR v_uid IN
    SELECT DISTINCT mp.user_id
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.state = 'confirmed'
      AND mp.user_id IS NOT NULL
  LOOP
    PERFORM public.recompute_player_stats_aggregates(v_uid);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_player_stats_for_match(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.fn_on_match_result_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    PERFORM public.recompute_player_stats_for_match(NEW.match_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_stats_on_result_confirmed ON public.match_results;
CREATE TRIGGER trg_player_stats_on_result_confirmed
  AFTER INSERT OR UPDATE OF status ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_on_match_result_confirmed();

-- One-shot backfill: reset ELO, process matches chronologically, rebuild aggregates.
CREATE OR REPLACE FUNCTION public.backfill_player_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_uid UUID;
BEGIN
  INSERT INTO public.player_stats (user_id)
  SELECT p.id FROM public.profiles p
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.player_stats
  SET
    elo_rating = 1200,
    matches_played = 0,
    wins = 0,
    losses = 0,
    current_streak = 0,
    best_win_streak = 0,
    tournaments_won = 0,
    tournament_finals = 0,
    tournament_thirds = 0,
    last_form = '[]'::jsonb,
    badges = '[]'::jsonb,
    updated_at = NOW();

  FOR r IN
    SELECT m.id
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
    ORDER BY m.start_at ASC, m.id ASC
  LOOP
    PERFORM public.apply_match_elo(r.id);
  END LOOP;

  FOR v_uid IN SELECT user_id FROM public.player_stats
  LOOP
    PERFORM public.recompute_player_stats_aggregates(v_uid);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_player_stats() FROM PUBLIC;
-- Intentionally not granted to authenticated — run via service role / SQL editor.

-- ─── get_player_stats ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_player_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

REVOKE ALL ON FUNCTION public.get_player_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_stats(UUID) TO authenticated;

-- ─── get_match_player_insights ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_match_player_insights(
  p_match_id UUID,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_players JSONB := '[]'::jsonb;
  v_h2h JSONB := '[]'::jsonb;
  v_pair JSONB := NULL;
  v_team_a UUID[];
  v_team_b UUID[];
  ua UUID;
  ub UUID;
  v_wins_a INT;
  v_wins_b INT;
  v_last TIMESTAMPTZ;
  v_pair_wins_a INT;
  v_pair_wins_b INT;
  v_pair_last TIMESTAMPTZ;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.viewer_can_access_match(p_match_id) THEN
    RAISE EXCEPTION 'match_access_denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.team, p.display_name), '[]'::jsonb)
  INTO v_players
  FROM (
    SELECT
      mp.user_id,
      pr.display_name,
      pr.photo_url,
      mp.team,
      COALESCE(ps.elo_rating, 1200) AS elo_rating,
      COALESCE(ps.matches_played, 0) AS matches_played,
      COALESCE(ps.wins, 0) AS wins,
      COALESCE(ps.losses, 0) AS losses,
      CASE WHEN COALESCE(ps.matches_played, 0) > 0 THEN
        ROUND((ps.wins::NUMERIC / ps.matches_played::NUMERIC) * 100, 1)
      ELSE 0 END AS win_rate,
      COALESCE(ps.current_streak, 0) AS current_streak,
      COALESCE(ps.last_form, '[]'::jsonb) AS last_form
    FROM public.match_participants mp
    JOIN public.profiles pr ON pr.id = mp.user_id
    LEFT JOIN public.player_stats ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.state = 'confirmed'
  ) p;

  SELECT COALESCE(array_agg(mp.user_id ORDER BY mp.joined_at), ARRAY[]::UUID[])
  INTO v_team_a
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id AND mp.state = 'confirmed' AND mp.team = 'A';

  SELECT COALESCE(array_agg(mp.user_id ORDER BY mp.joined_at), ARRAY[]::UUID[])
  INTO v_team_b
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id AND mp.state = 'confirmed' AND mp.team = 'B';

  FOREACH ua IN ARRAY COALESCE(v_team_a, ARRAY[]::UUID[])
  LOOP
    FOREACH ub IN ARRAY COALESCE(v_team_b, ARRAY[]::UUID[])
    LOOP
      SELECT
        COUNT(*) FILTER (
          WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS TRUE
        )::INT,
        COUNT(*) FILTER (
          WHERE public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS FALSE
        )::INT,
        MAX(m.start_at)
      INTO v_wins_a, v_wins_b, v_last
      FROM public.match_participants me
      JOIN public.match_participants opp
        ON opp.match_id = me.match_id
       AND opp.user_id = ub
       AND opp.team <> me.team
       AND opp.state = 'confirmed'
      JOIN public.matches m ON m.id = me.match_id
      JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
      WHERE me.user_id = ua
        AND me.state = 'confirmed'
        AND m.id <> p_match_id
        AND m.status = 'finished'
        AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
        AND public._player_won_match(me.team, mr.team_a_games, mr.team_b_games) IS NOT NULL;

      v_h2h := v_h2h || jsonb_build_array(
        jsonb_build_object(
          'user_a', ua,
          'user_b', ub,
          'wins_a', COALESCE(v_wins_a, 0),
          'wins_b', COALESCE(v_wins_b, 0),
          'last_meeting', v_last
        )
      );
    END LOOP;
  END LOOP;

  -- Pair H2H: same 4 registered players, opposite teams (order within team ignored)
  IF cardinality(v_team_a) = 2 AND cardinality(v_team_b) = 2 THEN
    SELECT
      COUNT(*) FILTER (
        WHERE (
          (
            hist.pair_a = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
            AND hist.team_a_won
          )
          OR (
            hist.pair_b = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
            AND NOT hist.team_a_won
          )
        )
      )::INT,
      COUNT(*) FILTER (
        WHERE (
          (
            hist.pair_a = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
            AND NOT hist.team_a_won
          )
          OR (
            hist.pair_b = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
            AND hist.team_a_won
          )
        )
      )::INT,
      MAX(hist.start_at)
    INTO v_pair_wins_a, v_pair_wins_b, v_pair_last
    FROM (
      SELECT
        m.start_at,
        (
          SELECT array_agg(x.user_id ORDER BY x.user_id)
          FROM public.match_participants x
          WHERE x.match_id = m.id AND x.state = 'confirmed' AND x.team = 'A'
        ) AS pair_a,
        (
          SELECT array_agg(x.user_id ORDER BY x.user_id)
          FROM public.match_participants x
          WHERE x.match_id = m.id AND x.state = 'confirmed' AND x.team = 'B'
        ) AS pair_b,
        (mr.team_a_games > mr.team_b_games) AS team_a_won
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
      WHERE m.id <> p_match_id
        AND m.status = 'finished'
        AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
        AND mr.team_a_games <> mr.team_b_games
    ) hist
    WHERE (
      (
        hist.pair_a = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
        AND hist.pair_b = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_b) u)
      )
      OR (
        hist.pair_a = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_b) u)
        AND hist.pair_b = (SELECT array_agg(u ORDER BY u) FROM unnest(v_team_a) u)
      )
    );

    IF COALESCE(v_pair_wins_a, 0) + COALESCE(v_pair_wins_b, 0) > 0 THEN
      v_pair := jsonb_build_object(
        'wins_a', COALESCE(v_pair_wins_a, 0),
        'wins_b', COALESCE(v_pair_wins_b, 0),
        'last_meeting', v_pair_last
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'players', COALESCE(v_players, '[]'::jsonb),
    'individual_h2h', COALESCE(v_h2h, '[]'::jsonb),
    'pair_h2h', v_pair
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_player_insights(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_player_insights(UUID, UUID) TO authenticated;

-- ─── get_leaderboard ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_city TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lim INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      ps.user_id,
      pr.display_name,
      pr.photo_url,
      pr.city,
      ps.elo_rating,
      ps.matches_played,
      ps.wins,
      ps.losses,
      CASE WHEN ps.matches_played > 0 THEN
        ROUND((ps.wins::NUMERIC / ps.matches_played::NUMERIC) * 100, 1)
      ELSE 0 END AS win_rate
    FROM public.player_stats ps
    JOIN public.profiles pr ON pr.id = ps.user_id
    WHERE ps.matches_played > 0
      AND (p_city IS NULL OR p_city = '' OR pr.city ILIKE p_city)
    ORDER BY ps.elo_rating DESC, ps.wins DESC, ps.matches_played DESC
    LIMIT v_lim
  ) r;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) TO authenticated;

-- Seed rows + backfill existing confirmed results (best-effort on migrate).
DO $$
BEGIN
  PERFORM public.backfill_player_stats();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'player_stats backfill skipped: %', SQLERRM;
END;
$$;
