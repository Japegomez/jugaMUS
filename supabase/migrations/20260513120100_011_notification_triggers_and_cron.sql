-- Migration 011: Notification triggers (participant join, match change) +
-- pg_cron / pg_net setup + process_match_state_transitions() SQL function.
--
-- pg_cron SCHEDULE NOTES (update values after first Edge Function deploy):
--   app.edge_function_url  — full base URL, e.g. https://<ref>.supabase.co/functions/v1
--   app.service_role_key   — set via: ALTER DATABASE postgres SET app.service_role_key = '<key>';
--   Do NOT commit real keys; set them in Supabase Dashboard → Settings → Database → Custom config,
--   or run the ALTER DATABASE command manually in Supabase SQL editor.

-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA cron;

-- ── Helper: insert a notification (used by triggers and cron function) ────────

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id      UUID,
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT,
  p_payload_json JSONB DEFAULT NULL,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_queue
    (user_id, type, title, body, payload_json, scheduled_for)
  VALUES
    (p_user_id, p_type, p_title, p_body, p_payload_json, p_scheduled_for);
END;
$$;

-- ── Trigger: notify match creator when a participant joins ────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match        public.matches%ROWTYPE;
  v_joiner_name  TEXT;
BEGIN
  -- Only fire for new confirmed participants, not re-joins or left events
  IF NEW.state <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;

  -- Don't notify if the creator is joining their own match
  IF v_match.creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_joiner_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.enqueue_notification(
    p_user_id       := v_match.creator_id,
    p_type          := 'participant_joined',
    p_title         := 'Nuevo jugador en tu partida',
    p_body          := COALESCE(v_joiner_name, 'Alguien') || ' se ha unido a «' || v_match.title || '»',
    p_payload_json  := jsonb_build_object('match_id', v_match.id, 'user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_participant_join ON public.match_participants;
CREATE TRIGGER trg_notify_participant_join
  AFTER INSERT ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_on_participant_join();

-- ── Trigger: notify participants when match is edited or cancelled ────────────

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
      AND user_id <> NEW.creator_id   -- creator already knows
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

DROP TRIGGER IF EXISTS trg_notify_match_change ON public.matches;
CREATE TRIGGER trg_notify_match_change
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_on_match_change();

-- ── process_match_state_transitions() ────────────────────────────────────────
-- Called by pg_cron every minute.
-- Handles:
--   1. planned → in_progress  (when start_at <= NOW())
--   2. in_progress → finished_no_result  (12 h without confirmed result)
--   3. Reminder 24h before match  (for each participant, deduped)
--   4. Reminder 2h before match   (for each participant, deduped)
--   5. Reminder 5h into match     (in_progress + no result yet, deduped)

CREATE OR REPLACE FUNCTION public.process_match_state_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match     RECORD;
  v_part      RECORD;
BEGIN

  -- 1. planned → in_progress ------------------------------------------------
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND start_at <= NOW()
  LOOP
    UPDATE public.matches SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'in_progress', 'system', 'start_at reached');

    -- Notify all confirmed participants that the match is in progress
    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed'
    LOOP
      PERFORM public.enqueue_notification(
        p_user_id       := v_part.user_id,
        p_type          := 'match_started',
        p_title         := '¡Tu partida ha empezado!',
        p_body          := 'La partida «' || v_match.title || '» está en curso. Recuerda registrar el resultado.',
        p_payload_json  := jsonb_build_object('match_id', v_match.id)
      );
    END LOOP;
  END LOOP;

  -- 2. in_progress → finished_no_result (12 h without confirmed result) ------
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'in_progress'
      AND start_at + INTERVAL '12 hours' <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.match_results mr
        WHERE mr.match_id = matches.id
          AND mr.status   = 'confirmed'
      )
  LOOP
    UPDATE public.matches SET status = 'finished_no_result', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'in_progress', 'finished_no_result', 'system', '12h without confirmed result');

    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed'
    LOOP
      PERFORM public.enqueue_notification(
        p_user_id       := v_part.user_id,
        p_type          := 'match_finished_no_result',
        p_title         := 'Partida finalizada sin resultado',
        p_body          := 'La partida «' || v_match.title || '» se cerró sin resultado registrado.',
        p_payload_json  := jsonb_build_object('match_id', v_match.id)
      );
    END LOOP;
  END LOOP;

  -- 3. Reminder 24h before (window: 24h00–24h01 from now) -------------------
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND start_at BETWEEN NOW() + INTERVAL '23 hours 59 minutes'
                       AND NOW() + INTERVAL '24 hours 1 minute'
  LOOP
    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed'
    LOOP
      -- Dedup: skip if a reminder of this type for this match+user already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.notification_queue nq
        WHERE nq.user_id = v_part.user_id
          AND nq.type    = 'reminder_24h'
          AND nq.payload_json->>'match_id' = v_match.id::text
      ) THEN
        PERFORM public.enqueue_notification(
          p_user_id       := v_part.user_id,
          p_type          := 'reminder_24h',
          p_title         := 'Tu partida es mañana',
          p_body          := 'Recuerda que mañana tienes la partida «' || v_match.title || '».',
          p_payload_json  := jsonb_build_object('match_id', v_match.id)
        );
      END IF;
    END LOOP;
  END LOOP;

  -- 4. Reminder 2h before (window: 1h59–2h01 from now) ----------------------
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND start_at BETWEEN NOW() + INTERVAL '1 hour 59 minutes'
                       AND NOW() + INTERVAL '2 hours 1 minute'
  LOOP
    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notification_queue nq
        WHERE nq.user_id = v_part.user_id
          AND nq.type    = 'reminder_2h'
          AND nq.payload_json->>'match_id' = v_match.id::text
      ) THEN
        PERFORM public.enqueue_notification(
          p_user_id       := v_part.user_id,
          p_type          := 'reminder_2h',
          p_title         := 'Tu partida empieza en 2 horas',
          p_body          := '¡Prepárate! La partida «' || v_match.title || '» empieza en 2 horas.',
          p_payload_json  := jsonb_build_object('match_id', v_match.id)
        );
      END IF;
    END LOOP;
  END LOOP;

  -- 5. Reminder 5h in_progress (window: start_at + 4h59 – start_at + 5h01) --
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'in_progress'
      AND start_at + INTERVAL '4 hours 59 minutes' <= NOW()
      AND start_at + INTERVAL '5 hours 1 minute'  >= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.match_results mr
        WHERE mr.match_id = matches.id
          AND mr.status IN ('confirmed', 'pending_validation')
      )
  LOOP
    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notification_queue nq
        WHERE nq.user_id = v_part.user_id
          AND nq.type    = 'reminder_5h_in_progress'
          AND nq.payload_json->>'match_id' = v_match.id::text
      ) THEN
        PERFORM public.enqueue_notification(
          p_user_id       := v_part.user_id,
          p_type          := 'reminder_5h_in_progress',
          p_title         := '¿Habéis terminado la partida?',
          p_body          := 'Lleváis 5 horas en «' || v_match.title || '». No olvidéis registrar el resultado.',
          p_payload_json  := jsonb_build_object('match_id', v_match.id)
        );
      END IF;
    END LOOP;
  END LOOP;

END;
$$;

-- ── pg_cron jobs ──────────────────────────────────────────────────────────────
-- 1. State transitions + timed reminders: every minute
SELECT cron.schedule(
  'match-state-transitions',
  '* * * * *',
  'SELECT public.process_match_state_transitions()'
);

-- 2. Process notification queue via Edge Function: every minute
--    The Edge Function is deployed with verify_jwt=false so no auth header is needed.
--    If the project ref changes, update the URL below.
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$SELECT extensions.http_post(
    url     := 'https://gnseokumiqtdtdzyrldk.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  )$$
);
