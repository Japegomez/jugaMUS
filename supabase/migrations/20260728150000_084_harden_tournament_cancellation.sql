-- 084: Harden tournament cancellation helpers.
--
-- cancel_all_tournament_matches:
--   · Only cancels open (planned / in_progress) matches; finished matches and
--     their confirmed results are preserved.
--   · Saves and restores app.suppress_match_change_notify rather than forcing
--     it to '0', so nested callers that already suppressed the setting keep it.
--   · Revokes direct EXECUTE from authenticated; must be called through an
--     authorized SECURITY DEFINER wrapper (cancel_tournament, etc.).
--
-- cancel_tournament_if_unplayable:
--   · Excludes pure placeholder matches (no pairs assigned yet) from the
--     "still-open" guard, so a bracket where all source matches were cancelled
--     no longer keeps the tournament artificially alive.
--
-- process_tournament_lifecycle:
--   · Scopes the in_progress tournament sweep to only tournaments where every
--     non-bye, non-placeholder match is already finished/cancelled, avoiding
--     unnecessary lock contention on active tournaments.

-- ─────────────────────────────────────────────────────────────────────────────
-- cancel_all_tournament_matches
-- ─────────────────────────────────────────────────────────────────────────────

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
        (v_match.id, v_match.status, 'cancelled', p_triggered_by, p_reason);
    END IF;
  END LOOP;

  PERFORM set_config('app.suppress_match_change_notify', v_prev_suppress, true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_all_tournament_matches(UUID, TEXT, TEXT) FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- cancel_tournament_if_unplayable
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Count as "still open" only matches that have at least one pair assigned
  -- (genuine matches or partially-filled brackets).  Pure placeholder matches
  -- (no pairs on either side) whose source matches were already cancelled will
  -- never receive participants and must not block the unplayable check.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- process_tournament_lifecycle
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Cancel planned matches with insufficient roster and possibly their tournament
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

  -- Cancel tournaments in registration that started without a bracket
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

  -- Check in_progress tournaments that might now be unplayable.
  -- Only examine tournaments where every non-bye, non-placeholder bracket match
  -- is already finished or cancelled (i.e. no open matches remain).  Tournaments
  -- with at least one genuinely open match are skipped entirely — the trigger on
  -- match status changes handles them as they close.
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
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM authenticated;
