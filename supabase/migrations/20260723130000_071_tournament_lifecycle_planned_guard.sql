-- 071: Guard tournament match auto-cancel UPDATE on status = 'planned'
-- so concurrent status changes do not insert mismatched transitions.

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
  -- Bracket matches past start with incomplete roster → cancelled.
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

  -- Registration tournaments past start without organized bracket → cancelled.
  FOR v_tournament IN
    SELECT t.id, t.title, t.creator_id
    FROM public.tournaments t
    WHERE t.status = 'registration'
      AND t.start_at <= NOW()
      AND t.bracket_generated_at IS NULL
  LOOP
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
