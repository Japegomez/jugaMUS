-- 077: Respect profile notify_push / notify_on_* when enqueueing notifications.
-- Maps every known notification type to an event preference category.

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id       UUID,
  p_type          TEXT,
  p_title         TEXT,
  p_body          TEXT,
  p_payload_json  JSONB DEFAULT NULL,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push     BOOLEAN;
  v_join     BOOLEAN;
  v_change   BOOLEAN;
  v_result   BOOLEAN;
  v_reminder BOOLEAN;
  v_allowed  BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_type IS NULL THEN
    RETURN;
  END IF;

  SELECT
    p.notify_push,
    p.notify_on_join,
    p.notify_on_match_change,
    p.notify_on_result,
    p.notify_on_reminder
  INTO
    v_push,
    v_join,
    v_change,
    v_result,
    v_reminder
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- No profile or push master switch off → do not enqueue.
  IF NOT FOUND OR NOT COALESCE(v_push, FALSE) THEN
    RETURN;
  END IF;

  v_allowed := CASE p_type
    -- Join
    WHEN 'participant_joined' THEN v_join

    -- Match / tournament edits, cancels, lifecycle status changes
    WHEN 'match_cancelled' THEN v_change
    WHEN 'match_updated' THEN v_change
    WHEN 'match_cancelled_insufficient' THEN v_change
    WHEN 'tournament_cancelled' THEN v_change
    WHEN 'match_started' THEN v_change
    WHEN 'match_finished_no_result' THEN v_change

    -- Results
    WHEN 'result_pending_validation' THEN v_result

    -- Reminders
    WHEN 'reminder_24h' THEN v_reminder
    WHEN 'reminder_2h' THEN v_reminder
    WHEN 'reminder_5h_in_progress' THEN v_reminder

    -- Unknown future types: still require push on, allow until mapped.
    ELSE TRUE
  END;

  IF NOT COALESCE(v_allowed, FALSE) THEN
    RETURN;
  END IF;

  INSERT INTO public.notification_queue
    (user_id, type, title, body, payload_json, scheduled_for)
  VALUES
    (p_user_id, p_type, p_title, p_body, p_payload_json, p_scheduled_for);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM authenticated;
-- Keep callable by SECURITY DEFINER triggers / cron (owner / service role).
