-- 080: PR review follow-ups for already-applied 073–079.
-- - Least-privilege revoke on create_tournament
-- - cancel_tournament: state transitions + drop pending reminders
-- - Restore legacy notify columns for staggered mobile clients

REVOKE ALL ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, NUMERIC
) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_tournament(p_tournament_id UUID)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_user_id UUID;
  v_match RECORD;
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

  FOR v_match IN
    SELECT m.id, m.status
    FROM public.matches m
    WHERE m.tournament_id = p_tournament_id
      AND m.status IN ('planned', 'in_progress')
  LOOP
    UPDATE public.matches
    SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = v_match.id
      AND status IN ('planned', 'in_progress');

    IF FOUND THEN
      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, reason)
      VALUES
        (v_match.id, v_match.status, 'cancelled', 'user', 'tournament_cancelled');
    END IF;
  END LOOP;

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

REVOKE ALL ON FUNCTION public.cancel_tournament(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_tournament(UUID) TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_on_match_change BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_reminder BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.profiles
SET
  notify_on_match_change =
    notify_on_match_start OR notify_on_match_edit OR notify_on_match_cancel,
  notify_on_reminder =
    notify_on_reminder_24h OR notify_on_reminder_2h OR notify_on_reminder_in_progress
WHERE TRUE;

CREATE OR REPLACE FUNCTION public.profiles_sync_legacy_notify_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.notify_on_match_change IS DISTINCT FROM OLD.notify_on_match_change
      AND NEW.notify_on_match_start IS NOT DISTINCT FROM OLD.notify_on_match_start
      AND NEW.notify_on_match_edit IS NOT DISTINCT FROM OLD.notify_on_match_edit
      AND NEW.notify_on_match_cancel IS NOT DISTINCT FROM OLD.notify_on_match_cancel
    THEN
      NEW.notify_on_match_start := NEW.notify_on_match_change;
      NEW.notify_on_match_edit := NEW.notify_on_match_change;
      NEW.notify_on_match_cancel := NEW.notify_on_match_change;
    END IF;

    IF NEW.notify_on_reminder IS DISTINCT FROM OLD.notify_on_reminder
      AND NEW.notify_on_reminder_24h IS NOT DISTINCT FROM OLD.notify_on_reminder_24h
      AND NEW.notify_on_reminder_2h IS NOT DISTINCT FROM OLD.notify_on_reminder_2h
      AND NEW.notify_on_reminder_in_progress IS NOT DISTINCT FROM OLD.notify_on_reminder_in_progress
    THEN
      NEW.notify_on_reminder_24h := NEW.notify_on_reminder;
      NEW.notify_on_reminder_2h := NEW.notify_on_reminder;
      NEW.notify_on_reminder_in_progress := NEW.notify_on_reminder;
    END IF;
  END IF;

  NEW.notify_on_match_change :=
    NEW.notify_on_match_start OR NEW.notify_on_match_edit OR NEW.notify_on_match_cancel;
  NEW.notify_on_reminder :=
    NEW.notify_on_reminder_24h OR NEW.notify_on_reminder_2h OR NEW.notify_on_reminder_in_progress;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_legacy_notify_prefs ON public.profiles;
CREATE TRIGGER trg_profiles_sync_legacy_notify_prefs
  BEFORE INSERT OR UPDATE OF
    notify_on_match_change,
    notify_on_match_start,
    notify_on_match_edit,
    notify_on_match_cancel,
    notify_on_reminder,
    notify_on_reminder_24h,
    notify_on_reminder_2h,
    notify_on_reminder_in_progress
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_sync_legacy_notify_prefs();

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, city, photo_url, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, role, status, created_at, updated_at
) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, phone_e164, city, photo_url, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, push_token
) ON public.profiles TO authenticated;
