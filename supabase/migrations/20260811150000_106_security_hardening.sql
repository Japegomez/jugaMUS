-- 106: Security hardening follow-up (after sync main → develop)
-- Addresses security review findings:
--   1. process_league_lifecycle was exposed as a privileged RPC with no REVOKE and no
--      auth check (SECURITY DEFINER, default PUBLIC execute). Any caller could run
--      global league lifecycle: expire challenges, cancel in-progress league matches
--      and force leagues to finish across ALL leagues.
--   2. Migration 104 had a REVOKE typo (enqueue_player_stats_recompute_queue vs the
--      real name enqueue_player_stats_recompute). Defensive REVOKE here covers any
--      environment where 104 was applied with the broken line skipped.
--   3. get_player_stats triggered refresh_player_stats (full-history ELO rebuild +
--      aggregate/badge recompute) for ANY caller, including anon viewing other users.
--      The refresh is now gated to self/admin only; others read cached stats.

-- ── 1. Lock down process_league_lifecycle (mirror process_tournament_lifecycle) ────
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM anon;
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM authenticated;

-- Schedule it alongside the existing match-state-transitions cron job (every minute).
SELECT cron.unschedule('match-state-transitions');
SELECT cron.schedule(
  'match-state-transitions',
  '* * * * *',
  $cron$
    SELECT public.process_match_state_transitions();
    SELECT public.process_tournament_lifecycle();
    SELECT public.process_league_lifecycle();
  $cron$
);

-- ── 2. Defensive REVOKE for enqueue_player_stats_recompute (migration 104 typo) ─────
REVOKE ALL ON FUNCTION public.enqueue_player_stats_recompute(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_player_stats_recompute(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_player_stats_recompute(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.process_player_stats_recompute_queue(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_player_stats_recompute_queue(INT) FROM anon;
REVOKE ALL ON FUNCTION public.process_player_stats_recompute_queue(INT) FROM authenticated;
REVOKE ALL ON FUNCTION public.recompute_player_stats_for_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_player_stats_for_match(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.recompute_player_stats_for_match(UUID) FROM authenticated;

-- Internal helpers used by get_player_stats refresh path — not client RPCs.
-- Without this, anon/authenticated could call refresh_player_stats directly and
-- bypass the self/admin gate inside get_player_stats.
REVOKE ALL ON FUNCTION public.refresh_player_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_player_stats(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_player_stats(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.rebuild_player_elo(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_player_elo(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.rebuild_player_elo(UUID) FROM authenticated;

-- ── 3. Gate refresh_player_stats to self/admin inside get_player_stats ─────────────
-- Only the user themselves (or an admin) triggers the expensive full-history recompute.
-- Other callers (including anon) get the cached stats — read-only, no amplification.
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

  -- Only refresh (expensive full-history recompute) when the caller is the user
  -- themselves or an admin. Other callers get the cached stats.
  IF p_user_id = auth.uid() OR public.auth_is_admin() THEN
    PERFORM public.refresh_player_stats(p_user_id);
  END IF;

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
