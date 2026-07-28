-- 081: Fix false tournament cancellation when the final (or next round) is being populated.
--
-- cancel_tournament_if_unplayable only counted matches with BOTH pairs assigned.
-- When the last semifinal finished, the trigger ran before advance_tournament_round
-- filled the final slot, so the tournament was wrongly marked cancelled.
--
-- Also advance the bracket in the match-end trigger before the unplayable check.

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

  -- Any non-bye bracket match still open (including placeholders waiting for winners).
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
    IF NEW.status = 'finished' THEN
      PERFORM public.advance_tournament_round(NEW.id);
    END IF;

    PERFORM public.finalize_tournament_if_final_match(NEW.id);
    PERFORM public.cancel_tournament_if_unplayable(NEW.tournament_id);
  END IF;
  RETURN NEW;
END;
$$;
