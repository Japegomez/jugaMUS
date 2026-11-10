-- 122: Revoke EXECUTE on internal helpers from anon + authenticated (Strix High/Medium).
-- Closes vuln-0002 / 0004 / 0005 / 0007 / 0010.
-- Also: make apply_match_elo idempotent; stop accepting p_triggered_by on cancel_all_tournament_matches.

-- ── apply_match_elo: idempotency via match_results.elo_applied_at ─────────────
ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS elo_applied_at TIMESTAMPTZ;

-- Existing confirmed results already had ELO applied by the historical trigger path.
-- Stamp them so the first post-migration call cannot double-apply.
UPDATE public.match_results
SET elo_applied_at = COALESCE(updated_at, created_at, NOW())
WHERE status = 'confirmed'
  AND elo_applied_at IS NULL;

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
  IF v_result.elo_applied_at IS NOT NULL THEN
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

  UPDATE public.match_results
  SET elo_applied_at = NOW()
  WHERE id = v_result.id
    AND elo_applied_at IS NULL;
END;
$$;

-- ── cancel_all_tournament_matches: drop p_triggered_by from the public signature ─
DROP FUNCTION IF EXISTS public.cancel_all_tournament_matches(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_all_tournament_matches(
  p_tournament_id UUID,
  p_reason TEXT DEFAULT 'tournament_cancelled'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match         RECORD;
  v_prev_suppress TEXT;
BEGIN
  IF p_tournament_id IS NULL THEN
    RETURN;
  END IF;

  v_prev_suppress := COALESCE(current_setting('app.suppress_match_change_notify', true), '0');
  PERFORM set_config('app.suppress_match_change_notify', '1', true);

  FOR v_match IN
    SELECT m.id, m.status
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND m.status IN ('planned', 'in_progress')
  LOOP
    UPDATE public.matches
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id
      AND status IN ('planned', 'in_progress');

    IF FOUND THEN
      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, reason)
      VALUES
        (v_match.id, v_match.status, 'cancelled', 'system', p_reason);
    END IF;
  END LOOP;

  PERFORM set_config('app.suppress_match_change_notify', v_prev_suppress, true);
END;
$$;

-- Update callers to the 2-arg signature (bodies from 082 / 084).
CREATE OR REPLACE FUNCTION public.cancel_tournament(p_tournament_id UUID)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_tournament_id IS NULL THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF v_tournament.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tournament.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'tournament_not_cancellable';
  END IF;

  PERFORM public.cancel_all_tournament_matches(
    p_tournament_id,
    'tournament_cancelled'
  );

  DELETE FROM public.notification_queue nq
  WHERE nq.status = 'pending'
    AND nq.type IN ('reminder_24h', 'reminder_2h', 'reminder_5h_in_progress')
    AND (
      nq.payload_json->>'tournament_id' = p_tournament_id::text
      OR nq.payload_json->>'match_id' IN (
        SELECT m.id::text
        FROM public.matches m
        WHERE m.tournament_id = p_tournament_id
      )
    );

  UPDATE public.tournaments
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_tournament_id
  RETURNING * INTO v_tournament;

  FOR v_user_id IN
    SELECT DISTINCT uid
    FROM (
      SELECT tp.player_a_user_id AS uid
      FROM public.tournament_pairs tp
      WHERE tp.tournament_id = p_tournament_id
        AND tp.player_a_user_id IS NOT NULL
      UNION
      SELECT tp.player_b_user_id AS uid
      FROM public.tournament_pairs tp
      WHERE tp.tournament_id = p_tournament_id
        AND tp.player_b_user_id IS NOT NULL
    ) players
    WHERE uid IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM public.enqueue_notification(
      p_user_id       := v_user_id,
      p_type          := 'tournament_cancelled',
      p_title         := 'Torneo cancelado',
      p_body          := 'El torneo «' || v_tournament.title
        || '» ha sido cancelado por el organizador.',
      p_payload_json  := jsonb_build_object('tournament_id', p_tournament_id)
    );
  END LOOP;

  RETURN v_tournament;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tournament_if_unplayable(p_tournament_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_has_champion BOOLEAN;
BEGIN
  IF p_tournament_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND OR v_tournament.status <> 'in_progress' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND m.status IN ('planned', 'in_progress')
      AND (
        m.tournament_pair_a_id IS NOT NULL
        OR m.tournament_pair_b_id IS NOT NULL
        OR m.status = 'in_progress'
      )
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND COALESCE(m.tournament_round_size, 999) <= 2
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND COALESCE(m.tournament_is_third_place, FALSE) = FALSE
      AND (
        m.tournament_winner_pair_id IS NOT NULL
        OR (
          m.status = 'finished'
          AND EXISTS (
            SELECT 1
            FROM public.match_results mr
            WHERE mr.match_id = m.id
              AND mr.status = 'confirmed'
          )
        )
      )
  ) INTO v_has_champion;

  IF v_has_champion THEN
    PERFORM public.maybe_finish_tournament(p_tournament_id);
    RETURN;
  END IF;

  PERFORM public.cancel_all_tournament_matches(
    p_tournament_id,
    'tournament_unplayable'
  );

  UPDATE public.tournaments
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_tournament_id AND status = 'in_progress';

  PERFORM public.enqueue_notification(
    p_user_id       := v_tournament.creator_id,
    p_type          := 'tournament_cancelled',
    p_title         := 'Torneo cancelado',
    p_body          := 'El torneo «' || v_tournament.title
      || '» se canceló al no poder disputarse más partidos del cuadro.',
    p_payload_json  := jsonb_build_object('tournament_id', p_tournament_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_tournament_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match         RECORD;
  v_tournament    RECORD;
  v_tournament_id UUID;
BEGIN
  FOR v_match IN
    SELECT m.id, m.tournament_id
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.tournament_id IS NOT NULL
      AND m.start_at <= NOW()
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND m.tournament_pair_a_id IS NOT NULL
      AND m.tournament_pair_b_id IS NOT NULL
      AND public.match_effective_roster_filled(m.id) < 4
  LOOP
    UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id
      AND status = 'planned';

    IF FOUND THEN
      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, reason)
      VALUES
        (v_match.id, 'planned', 'cancelled', 'system', 'insufficient_players_at_start');

      PERFORM public.cancel_tournament_if_unplayable(v_match.tournament_id);
    END IF;
  END LOOP;

  FOR v_tournament IN
    SELECT t.id, t.title, t.creator_id
    FROM public.tournaments t
    WHERE t.status = 'registration'
      AND t.start_at <= NOW()
      AND t.bracket_generated_at IS NULL
  LOOP
    PERFORM public.cancel_all_tournament_matches(
      v_tournament.id,
      'tournament_cancelled_no_bracket'
    );

    UPDATE public.tournaments
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_tournament.id
      AND status = 'registration';

    PERFORM public.enqueue_notification(
      p_user_id       := v_tournament.creator_id,
      p_type          := 'tournament_cancelled',
      p_title         := 'Torneo cancelado',
      p_body          := 'El torneo «' || v_tournament.title
        || '» se canceló al llegar la hora de inicio sin cuadro organizado.',
      p_payload_json  := jsonb_build_object('tournament_id', v_tournament.id)
    );
  END LOOP;

  FOR v_tournament_id IN
    SELECT m.tournament_id
    FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE t.status = 'in_progress'
      AND m.tournament_id IS NOT NULL
      AND NOT COALESCE(m.tournament_is_bye, FALSE)
      AND (
        m.tournament_pair_a_id IS NOT NULL
        OR m.tournament_pair_b_id IS NOT NULL
        OR m.status = 'in_progress'
      )
    GROUP BY m.tournament_id
    HAVING bool_and(m.status NOT IN ('planned', 'in_progress'))
  LOOP
    PERFORM public.cancel_tournament_if_unplayable(v_tournament_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM anon;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM authenticated;

REVOKE ALL ON FUNCTION public.cancel_tournament(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_tournament(UUID) TO authenticated;

-- ── Tier 1: revoke from PUBLIC + anon + authenticated ─────────────────────────
-- Stats / ELO internals
REVOKE ALL ON FUNCTION public.apply_match_elo(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_match_elo(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.apply_match_elo(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.backfill_player_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_player_stats() FROM anon;
REVOKE ALL ON FUNCTION public.backfill_player_stats() FROM authenticated;

REVOKE ALL ON FUNCTION public.recompute_player_stats_aggregates(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_player_stats_aggregates(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.recompute_player_stats_aggregates(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.ensure_player_stats_row(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_player_stats_row(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_player_stats_row(UUID) FROM authenticated;

-- Cancel helpers
REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.cancel_all_league_matches(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_all_league_matches(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_all_league_matches(UUID) FROM authenticated;

-- Roster / bracket internals
REVOKE ALL ON FUNCTION public.populate_match_roster_from_pair(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.populate_match_roster_from_pair(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.populate_match_roster_from_pair(UUID, UUID, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.populate_match_roster_from_league_pair(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.populate_match_roster_from_league_pair(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.populate_match_roster_from_league_pair(UUID, UUID, TEXT) FROM authenticated;

REVOKE ALL ON FUNCTION public.assign_semifinal_loser_to_third_place(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_semifinal_loser_to_third_place(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.assign_semifinal_loser_to_third_place(UUID, UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.create_league_match(public.leagues, UUID, UUID, INT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_league_match(public.leagues, UUID, UUID, INT, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.create_league_match(public.leagues, UUID, UUID, INT, BOOLEAN) FROM authenticated;

REVOKE ALL ON FUNCTION public.maybe_finish_tournament(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maybe_finish_tournament(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.maybe_finish_tournament(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.advance_tournament_round(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_tournament_round(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.advance_tournament_round(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.propagate_tournament_winners(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_tournament_winners(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.propagate_tournament_winners(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.finalize_tournament_if_final_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_tournament_if_final_match(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_tournament_if_final_match(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.cancel_tournament_if_unplayable(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_tournament_if_unplayable(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_tournament_if_unplayable(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.maybe_finish_league(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maybe_finish_league(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.maybe_finish_league(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.recalculate_league_elo(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_league_elo(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.recalculate_league_elo(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.generate_league_catchup_matches(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_league_catchup_matches(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.generate_league_catchup_matches(UUID, UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.sync_tournament_pair_name(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_tournament_pair_name(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.sync_tournament_pair_name(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.inviter_team_capacity_available(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inviter_team_capacity_available(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.inviter_team_capacity_available(UUID, TEXT) FROM authenticated;

-- Trigger / updated_at helpers (EXECUTE not required for triggers to fire)
REVOKE ALL ON FUNCTION public.fn_notify_on_match_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notify_on_match_change() FROM anon;
REVOKE ALL ON FUNCTION public.fn_notify_on_match_change() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_notify_on_match_result_submitted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notify_on_match_result_submitted() FROM anon;
REVOKE ALL ON FUNCTION public.fn_notify_on_match_result_submitted() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_process_result_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_process_result_confirmation() FROM anon;
REVOKE ALL ON FUNCTION public.fn_process_result_confirmation() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_void_pending_results_on_match_cancelled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_void_pending_results_on_match_cancelled() FROM anon;
REVOKE ALL ON FUNCTION public.fn_void_pending_results_on_match_cancelled() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_notify_on_participant_join() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notify_on_participant_join() FROM anon;
REVOKE ALL ON FUNCTION public.fn_notify_on_participant_join() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_cancel_pending_invitations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_pending_invitations() FROM anon;
REVOKE ALL ON FUNCTION public.fn_cancel_pending_invitations() FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_on_match_result_confirmed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_on_match_result_confirmed() FROM anon;
REVOKE ALL ON FUNCTION public.fn_on_match_result_confirmed() FROM authenticated;

REVOKE ALL ON FUNCTION public.trg_finalize_tournament_on_match_end() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_finalize_tournament_on_match_end() FROM anon;
REVOKE ALL ON FUNCTION public.trg_finalize_tournament_on_match_end() FROM authenticated;

REVOKE ALL ON FUNCTION public.on_league_match_result_confirmed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_league_match_result_confirmed() FROM anon;
REVOKE ALL ON FUNCTION public.on_league_match_result_confirmed() FROM authenticated;

REVOKE ALL ON FUNCTION public.on_league_match_status_changed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_league_match_status_changed() FROM anon;
REVOKE ALL ON FUNCTION public.on_league_match_status_changed() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_profiles_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_profiles_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_profiles_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_matches_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_matches_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_matches_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_tournaments_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_tournaments_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_tournaments_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_leagues_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_leagues_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_leagues_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_league_pairs_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_league_pairs_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_league_pairs_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;

-- Account erasure helper: service_role only (called from the delete-account Edge
-- Function with the service key). It takes an arbitrary user id and performs no
-- caller check, so the API roles must not be able to invoke it.
REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
