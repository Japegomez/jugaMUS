-- 050: Standalone matches with start_at in the past should be in progress (not hidden/cancelled).

-- Backfill existing standalone planned matches whose start time has passed.
UPDATE public.matches
SET status = 'in_progress', updated_at = NOW()
WHERE status = 'planned'
  AND tournament_id IS NULL
  AND start_at <= NOW();

-- Allow joining while a standalone match is already in progress (open slots).
DROP POLICY IF EXISTS participants_insert_self ON public.match_participants;
CREATE POLICY participants_insert_self ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.status IN ('planned', 'in_progress')
        AND m.visibility IN ('public', 'link')
        AND m.tournament_id IS NULL
    )
  );

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

  -- 1. planned → in_progress (standalone match start time reached; roster may still have free slots)
  FOR v_match IN
    SELECT m.id, m.title, m.start_at
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.start_at <= NOW()
      AND m.tournament_id IS NULL
  LOOP
    UPDATE public.matches SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'in_progress', 'system', 'start_at reached');

    FOR v_part IN
      SELECT user_id FROM public.match_participants
      WHERE match_id = v_match.id AND state = 'confirmed' AND left_at IS NULL
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

CREATE OR REPLACE FUNCTION public.list_public_matches(
  p_search text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_start_after timestamptz DEFAULT NULL,
  p_start_before timestamptz DEFAULT NULL,
  p_min_free_slots integer DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  start_at timestamptz,
  city text,
  place_defined boolean,
  place_text text,
  duration_target_games integer,
  visibility text,
  location_privacy text,
  status text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  slots_filled integer,
  free_slots integer,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      m.id,
      m.title,
      m.description,
      m.start_at,
      m.city,
      m.place_defined,
      CASE
        WHEN m.location_privacy = 'participants_only'
          AND m.creator_id <> auth.uid()
          AND NOT public.auth_is_confirmed_in_match(m.id)
          THEN NULL
        ELSE m.place_text
      END AS place_text,
      m.duration_target_games,
      m.visibility,
      m.location_privacy,
      m.status,
      m.creator_id,
      m.created_at,
      m.updated_at,
      public.match_effective_roster_filled(m.id) AS slots_filled
    FROM public.matches m
    WHERE m.visibility = 'public'
      AND m.status <> 'cancelled'
      AND m.tournament_id IS NULL
      AND (
        p_search IS NULL
        OR TRIM(p_search) = ''
        OR m.title ILIKE ('%' || TRIM(p_search) || '%')
      )
      AND (
        p_city IS NULL
        OR TRIM(p_city) = ''
        OR m.city = TRIM(p_city)
      )
      AND (
        p_status IS NULL
        OR TRIM(p_status) = ''
        OR m.status = TRIM(p_status)
      )
      AND (
        p_start_after IS NULL
        OR m.start_at >= p_start_after
        OR (
          m.status IN ('planned', 'in_progress')
          AND m.start_at < p_start_after
        )
      )
      AND (p_start_before IS NULL OR m.start_at <= p_start_before)
  ),
  with_free AS (
    SELECT
      f.*,
      (4 - f.slots_filled) AS free_slots
    FROM filtered f
    WHERE (
      p_min_free_slots IS NULL
      OR p_min_free_slots <= 0
      OR (4 - f.slots_filled) >= p_min_free_slots
    )
  )
  SELECT
    w.id,
    w.title,
    w.description,
    w.start_at,
    w.city,
    w.place_defined,
    w.place_text,
    w.duration_target_games,
    w.visibility,
    w.location_privacy,
    w.status,
    w.creator_id,
    w.created_at,
    w.updated_at,
    w.slots_filled,
    w.free_slots,
    COUNT(*) OVER () AS total_count
  FROM with_free w
  ORDER BY w.start_at ASC
  LIMIT LEAST(100, GREATEST(1, COALESCE(NULLIF(p_limit, 0), 20)))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;
