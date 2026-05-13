-- Migration 012: Result submission + confirmation triggers (F7).
-- - After INSERT on match_results: notify rival-team confirmed participants.
-- - After INSERT on result_confirmations: dispute → disputed + report + notify;
--   approve → rival-only validation, confirm result, optionally finish match + transition row + notify.
-- - Patches fn_notify_on_match_change to skip duplicate "match_updated" pushes when
--   match status is updated programmatically from this flow (SET LOCAL flag).

-- ── Suppress generic match-change notifications (nested UPDATE on matches) ───

CREATE OR REPLACE FUNCTION public.fn_notify_on_match_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_participant RECORD;
  v_type        TEXT;
  v_title       TEXT;
  v_body        TEXT;
BEGIN
  IF current_setting('app.suppress_match_change_notify', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- Only fire on meaningful changes
  IF OLD.status = NEW.status
    AND OLD.title = NEW.title
    AND OLD.start_at = NEW.start_at
    AND OLD.city = NEW.city
    AND OLD.place_text IS NOT DISTINCT FROM NEW.place_text
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    v_type  := 'match_cancelled';
    v_title := 'Partida cancelada';
    v_body  := 'La partida «' || NEW.title || '» ha sido cancelada';
  ELSE
    v_type  := 'match_updated';
    v_title := 'Partida modificada';
    v_body  := 'La partida «' || NEW.title || '» ha sido actualizada';
  END IF;

  FOR v_participant IN
    SELECT user_id FROM public.match_participants
    WHERE match_id = NEW.id
      AND state    = 'confirmed'
      AND user_id <> NEW.creator_id
  LOOP
    PERFORM public.enqueue_notification(
      p_user_id      := v_participant.user_id,
      p_type         := v_type,
      p_title        := v_title,
      p_body         := v_body,
      p_payload_json := jsonb_build_object('match_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── Notify rival team when a result is submitted ─────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_match_result_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_part  RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;

  FOR v_part IN
    SELECT mp.user_id
    FROM public.match_participants mp
    WHERE mp.match_id = NEW.match_id
      AND mp.state = 'confirmed'
      AND mp.left_at IS NULL
      AND mp.team <> NEW.submitted_by_team
  LOOP
    PERFORM public.enqueue_notification(
      p_user_id      := v_part.user_id,
      p_type         := 'result_pending_validation',
      p_title        := 'Validar resultado',
      p_body         := 'El equipo contrario ha registrado el resultado de «' || v_match.title || '». Revísalo y confírmalo o disputa.',
      p_payload_json := jsonb_build_object('match_id', NEW.match_id, 'match_result_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_result_submitted ON public.match_results;
CREATE TRIGGER trg_notify_match_result_submitted
  AFTER INSERT ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_on_match_result_submitted();

-- ── Process confirmation / dispute / approve ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_process_result_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mr              public.match_results%ROWTYPE;
  m               public.matches%ROWTYPE;
  v_from_status   TEXT;
BEGIN
  SELECT * INTO mr FROM public.match_results WHERE id = NEW.match_result_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF mr.status IS DISTINCT FROM 'pending_validation' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = mr.match_id
      AND mp.user_id = NEW.user_id
      AND mp.team = NEW.team
      AND mp.state = 'confirmed'
      AND mp.left_at IS NULL
  ) THEN
    RAISE EXCEPTION '%', 'Datos de confirmación no válidos.';
  END IF;

  IF NEW.decision = 'dispute' THEN
    IF NEW.team = mr.submitted_by_team THEN
      RAISE EXCEPTION '%', 'Solo el equipo rival puede disputar el resultado.';
    END IF;

    UPDATE public.match_results
    SET status = 'disputed', updated_at = NOW()
    WHERE id = mr.id AND status = 'pending_validation';

    INSERT INTO public.reports (target_type, target_id, reason, notes, reporter_id)
    VALUES (
      'result',
      mr.id,
      'Disputa del resultado de partida',
      NULLIF(btrim(COALESCE(NEW.comment, '')), ''),
      NEW.user_id
    );

    RETURN NEW;
  END IF;

  IF NEW.decision = 'approve' THEN
    IF NEW.team = mr.submitted_by_team THEN
      RAISE EXCEPTION '%', 'Solo el equipo rival puede aprobar el resultado.';
    END IF;

    UPDATE public.match_results
    SET status = 'confirmed', updated_at = NOW()
    WHERE id = mr.id AND status = 'pending_validation';

    SELECT * INTO m FROM public.matches WHERE id = mr.match_id;

    IF FOUND AND m.status IN ('in_progress', 'finished_no_result') THEN
      v_from_status := m.status;
      PERFORM set_config('app.suppress_match_change_notify', '1', true);
      UPDATE public.matches
      SET status = 'finished', updated_at = NOW()
      WHERE id = m.id;
      PERFORM set_config('app.suppress_match_change_notify', '0', true);

      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, user_id, reason)
      VALUES
        (m.id, v_from_status, 'finished', 'user', NEW.user_id, 'Resultado confirmado');
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_result_confirmation ON public.result_confirmations;
CREATE TRIGGER trg_process_result_confirmation
  AFTER INSERT ON public.result_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_process_result_confirmation();

-- ── Privileges (trigger functions run in client transactions) ────────────────

REVOKE ALL ON FUNCTION public.fn_notify_on_match_result_submitted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_process_result_confirmation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_notify_on_match_result_submitted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_process_result_confirmation() TO authenticated;

-- ── Backfill: rows approved while trigger was missing (INSERT ok, no side effects) ──

UPDATE public.match_results mr
SET status = 'confirmed', updated_at = NOW()
WHERE mr.status = 'pending_validation'
  AND EXISTS (
    SELECT 1
    FROM public.result_confirmations rc
    WHERE rc.match_result_id = mr.id
      AND rc.decision = 'approve'
  );

UPDATE public.matches m
SET status = 'finished', updated_at = NOW()
WHERE m.status IN ('in_progress', 'finished_no_result')
  AND EXISTS (
    SELECT 1
    FROM public.match_results mr
    WHERE mr.match_id = m.id
      AND mr.status = 'confirmed'
  );
