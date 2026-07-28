-- 082: When a tournament is cancelled, cancel every bracket match (not only open ones).

CREATE OR REPLACE FUNCTION public.cancel_all_tournament_matches(
  p_tournament_id UUID,
  p_triggered_by TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT 'tournament_cancelled'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  IF p_tournament_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.suppress_match_change_notify', '1', true);

  FOR v_match IN
    SELECT m.id, m.status
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND m.status <> 'cancelled'
  LOOP
    UPDATE public.matches
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id
      AND status <> 'cancelled';

    IF FOUND THEN
      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, reason)
      VALUES
        (v_match.id, v_match.status, 'cancelled', p_triggered_by, p_reason);
    END IF;
  END LOOP;

  PERFORM set_config('app.suppress_match_change_notify', '0', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT, TEXT) FROM PUBLIC;

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
    'user',
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
    'system',
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
      'system',
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
    SELECT t.id FROM public.tournaments t WHERE t.status = 'in_progress'
  LOOP
    PERFORM public.cancel_tournament_if_unplayable(v_tournament_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM authenticated;
