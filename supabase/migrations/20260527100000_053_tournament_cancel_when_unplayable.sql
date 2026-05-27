-- 053: Cancel in-progress tournaments when the bracket can no longer be played
-- (e.g. bracket matches auto-cancelled, no pending playable matches, no champion).

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

  -- Same definition as app "Partidos pendientes" tab.
  IF EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND m.status IN ('planned', 'in_progress')
      AND m.tournament_pair_a_id IS NOT NULL
      AND m.tournament_pair_b_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND COALESCE(m.tournament_round_size, 999) <= 2
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
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
    UPDATE public.tournaments
    SET status = 'finished', updated_at = NOW()
    WHERE id = p_tournament_id AND status = 'in_progress';
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.cancel_tournament_if_unplayable(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_tournament_if_final_match(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.tournament_id IS NULL THEN RETURN; END IF;
  IF COALESCE(v_match.tournament_round_size, 999) > 2 THEN RETURN; END IF;
  IF COALESCE(v_match.tournament_is_bye, FALSE) THEN RETURN; END IF;
  IF v_match.status NOT IN ('finished', 'cancelled') THEN RETURN; END IF;

  IF v_match.status = 'finished' THEN
    PERFORM public.advance_tournament_round(p_match_id);
    RETURN;
  END IF;

  PERFORM public.cancel_tournament_if_unplayable(v_match.tournament_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_finalize_tournament_on_match_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tournament_id IS NOT NULL
     AND NEW.status IN ('finished', 'cancelled', 'finished_no_result')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    PERFORM public.finalize_tournament_if_final_match(NEW.id);
    PERFORM public.cancel_tournament_if_unplayable(NEW.tournament_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Repair stuck / wrongly finished tournaments (031 marked cancelled finals as finished).
UPDATE public.tournaments t
SET status = 'cancelled', updated_at = NOW()
WHERE t.status IN ('in_progress', 'finished')
  AND NOT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = t.id
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND m.status IN ('planned', 'in_progress')
      AND m.tournament_pair_a_id IS NOT NULL
      AND m.tournament_pair_b_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.tournament_id = t.id
      AND COALESCE(m.tournament_round_size, 999) <= 2
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND (
        m.tournament_winner_pair_id IS NOT NULL
        OR (
          m.status = 'finished'
          AND EXISTS (
            SELECT 1
            FROM public.match_results mr
            WHERE mr.match_id = m.id AND mr.status = 'confirmed'
          )
        )
      )
  );

-- Tournament bracket lifecycle (cron + triggers); keeps 051 process_match intact.
CREATE OR REPLACE FUNCTION public.process_tournament_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match         RECORD;
  v_tournament_id UUID;
BEGIN
  -- Bracket matches past start with incomplete roster → cancelled (standalone cron skipped these).
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
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'cancelled', 'system', 'insufficient_players_at_start');

    PERFORM public.cancel_tournament_if_unplayable(v_match.tournament_id);
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

SELECT cron.unschedule('match-state-transitions');

SELECT cron.schedule(
  'match-state-transitions',
  '* * * * *',
  $cron$
    SELECT public.process_match_state_transitions();
    SELECT public.process_tournament_lifecycle();
  $cron$
);
