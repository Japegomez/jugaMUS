-- 121: Throttle pg_cron on free compute + widen reminder windows.
-- Schedules:
--   match-state-transitions            → */5  (lifecycle + reminders)
--   process-notification-queue         → */10
--   process-player-stats-recompute     → */15 with batch 10 (was 50 every minute)
--   cleanup-pg-net-http-response       → daily 03:15 UTC
-- Reminder detection windows widened from ±1 min to ±6 min so */5 cron does not miss them.

CREATE OR REPLACE FUNCTION public.process_match_state_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match     RECORD;
  v_part      RECORD;
  v_updated   integer;
BEGIN

  -- 1a. in_progress -> cancelled (standalone, roster no longer full)
  FOR v_match IN
    SELECT m.id, m.title, m.creator_id
    FROM public.matches m
    WHERE m.status = 'in_progress'
      AND m.tournament_id IS NULL
      AND m.league_id IS NULL
      AND public.match_effective_roster_filled(m.id) < 4
  LOOP
    UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'in_progress', 'cancelled', 'system', 'roster_incomplete_while_in_progress');

    PERFORM public.enqueue_notification(
      p_user_id       := v_match.creator_id,
      p_type          := 'match_cancelled_insufficient',
      p_title         := 'Partida cancelada',
      p_body          := 'La partida «' || v_match.title
        || '» se canceló al no completarse la plantilla.',
      p_payload_json  := jsonb_build_object('match_id', v_match.id)
    );
  END LOOP;

  -- 1b. planned -> in_progress (start_at reached AND roster full)
  --     Solo partidas sueltas. Los fixtures de liga se quedan "planned"
  --     hasta que alguien los inicia o envia un resultado.
  --     Exclude matches already past the standalone 12h no-result window so
  --     this run does not emit match_started before step 2 closes them.
  FOR v_match IN
    SELECT m.id, m.title, m.start_at
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.start_at <= NOW()
      AND m.start_at + INTERVAL '12 hours' > NOW()
      AND m.tournament_id IS NULL
      AND m.league_id IS NULL
      AND public.match_effective_roster_filled(m.id) >= 4
  LOOP
    UPDATE public.matches SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'in_progress', 'system', 'start_at reached with full roster');

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

  -- 1c. planned -> cancelled (start_at reached, roster not full)
  --     Solo partidas sueltas. Los fixtures de liga no se cancelan automaticamente.
  FOR v_match IN
    SELECT m.id, m.title, m.start_at, m.creator_id
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.start_at <= NOW()
      AND m.tournament_id IS NULL
      AND m.league_id IS NULL
      AND public.match_effective_roster_filled(m.id) < 4
  LOOP
    UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'cancelled', 'system', 'insufficient_players_at_start');

    PERFORM public.enqueue_notification(
      p_user_id       := v_match.creator_id,
      p_type          := 'match_cancelled_insufficient',
      p_title         := 'Partida cancelada',
      p_body          := 'La partida «' || v_match.title
        || '» se canceló al no completarse el equipo a la hora de inicio.',
      p_payload_json  := jsonb_build_object('match_id', v_match.id)
    );
  END LOOP;

  -- 2. in_progress|planned(overdue standalone) -> finished_no_result
  --    - Partidas sueltas: 12h (also closes planned that skipped 1b)
  --    - Torneos: 24h (in_progress only)
  --    - Ligas: sin timeout automatico (se excluyen)
  FOR v_match IN
    SELECT id, title, start_at, tournament_id, status AS from_status
    FROM public.matches
    WHERE league_id IS NULL
      AND (
        (
          status = 'in_progress'
          AND (
            (tournament_id IS NOT NULL AND start_at + INTERVAL '24 hours' <= NOW())
            OR
            (tournament_id IS NULL     AND start_at + INTERVAL '12 hours' <= NOW())
          )
        )
        OR (
          status = 'planned'
          AND tournament_id IS NULL
          AND start_at + INTERVAL '12 hours' <= NOW()
          AND public.match_effective_roster_filled(id) >= 4
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.match_results mr
        WHERE mr.match_id = matches.id
          AND mr.status IN ('confirmed', 'pending_validation')
      )
  LOOP
    UPDATE public.matches SET status = 'finished_no_result', updated_at = NOW()
    WHERE id = v_match.id
      AND status = v_match.from_status;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, v_match.from_status, 'finished_no_result', 'system',
       CASE WHEN v_match.tournament_id IS NOT NULL
            THEN '24h without confirmed result (tournament)'
            ELSE '12h without confirmed result' END);

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

  -- 3. Reminder 24h before (±6 min window for */5 cron)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND tournament_id IS NULL
      AND league_id IS NULL
      AND start_at BETWEEN NOW() + INTERVAL '23 hours 54 minutes'
                       AND NOW() + INTERVAL '24 hours 6 minutes'
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
          AND nq.payload_json->>'start_at' = v_match.start_at::text
      ) THEN
        PERFORM public.enqueue_notification(
          p_user_id       := v_part.user_id,
          p_type          := 'reminder_24h',
          p_title         := 'Tu partida es mañana',
          p_body          := 'Recuerda que mañana tienes la partida «' || v_match.title || '».',
          p_payload_json  := jsonb_build_object(
            'match_id', v_match.id,
            'start_at', v_match.start_at
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  -- 4. Reminder 2h before (±6 min window)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND tournament_id IS NULL
      AND league_id IS NULL
      AND start_at BETWEEN NOW() + INTERVAL '1 hour 54 minutes'
                       AND NOW() + INTERVAL '2 hours 6 minutes'
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
          AND nq.payload_json->>'start_at' = v_match.start_at::text
      ) THEN
        PERFORM public.enqueue_notification(
          p_user_id       := v_part.user_id,
          p_type          := 'reminder_2h',
          p_title         := 'Tu partida empieza en 2 horas',
          p_body          := '¡Prepárate! La partida «' || v_match.title || '» empieza en 2 horas.',
          p_payload_json  := jsonb_build_object(
            'match_id', v_match.id,
            'start_at', v_match.start_at
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  -- 5. Reminder 5h in_progress (±6 min window)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'in_progress'
      AND league_id IS NULL
      AND start_at + INTERVAL '4 hours 54 minutes' <= NOW()
      AND start_at + INTERVAL '5 hours 6 minutes'  >= NOW()
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

COMMENT ON FUNCTION public.process_match_state_transitions IS
  'Cron */5. Reminder windows ±6 min. Torneos: 24h sin resultado -> finished_no_result. Ligas: sin timeout automatico. Partidas sueltas: 12h.';

-- Keep client roles locked down (same as migration 118).
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM anon;
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM authenticated;

-- ── Reschedule existing jobs ──────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('match-state-transitions');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule(
  'match-state-transitions',
  '*/5 * * * *',
  $cron$
    SELECT public.process_match_state_transitions();
    SELECT public.process_tournament_lifecycle();
    SELECT public.process_league_lifecycle();
  $cron$
);

DO $$
BEGIN
  PERFORM cron.unschedule('process-notification-queue');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule(
  'process-notification-queue',
  '*/10 * * * *',
  $$SELECT net.http_post(
    url := (SELECT value FROM private.runtime_config WHERE key = 'edge_function_url') || '/process-notifications',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT value FROM private.runtime_config WHERE key = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  )$$
);

DO $$
BEGIN
  PERFORM cron.unschedule('process-player-stats-recompute-queue');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule(
  'process-player-stats-recompute-queue',
  '*/15 * * * *',
  'SELECT public.process_player_stats_recompute_queue(10)'
);

-- ── Daily pg_net response cleanup ─────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-pg-net-http-response');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule(
  'cleanup-pg-net-http-response',
  '15 3 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '2 days'$$
);

-- NOTE: do not bulk-DELETE net._http_response in this migration.
-- Under free-tier CPU/IO saturation a large DELETE can timeout the apply.
-- After CPU cools (or after a project restart), run once in SQL Editor:
--   DELETE FROM net._http_response WHERE created < now() - interval '1 day';
-- Daily cron cleanup-pg-net-http-response keeps it trimmed going forward.
