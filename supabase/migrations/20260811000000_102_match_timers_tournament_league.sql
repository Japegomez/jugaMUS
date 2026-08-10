-- 102: Ajustar timers de partidas
--   - Torneos: 24h sin resultado -> finished_no_result (antes 12h)
--   - Ligas round-robin: los fixtures se quedan "planned" hasta que se juegan
--     (no auto-inicio por cron, no auto-cancelacion, no auto sin-resultado)
--   - Partidas sueltas: 12h (sin cambio)
--   - submit_match_result auto-inicia partidas de liga "planned" al recibir resultado

-- =========================================================================
-- 1. Revertir fixtures de liga que el cron arranco prematuramente a in_progress
--    (solo los que no tienen resultado enviado)
-- =========================================================================
WITH reverted AS (
  UPDATE public.matches
  SET status = 'planned', updated_at = NOW()
  WHERE status = 'in_progress'
    AND league_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.match_results mr
      WHERE mr.match_id = matches.id
        AND mr.status IN ('pending_validation', 'confirmed')
    )
  RETURNING id
)
INSERT INTO public.match_state_transitions
  (match_id, from_status, to_status, triggered_by, reason)
SELECT id, 'in_progress', 'planned', 'system',
       'Reverted: league fixtures stay planned until played'
FROM reverted;

-- =========================================================================
-- 2. Reescribir process_match_state_transitions
-- =========================================================================
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
  FOR v_match IN
    SELECT m.id, m.title, m.start_at
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.start_at <= NOW()
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

  -- 2. in_progress -> finished_no_result
  --    - Partidas sueltas: 12h
  --    - Torneos: 24h
  --    - Ligas: sin timeout automatico (se excluyen)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'in_progress'
      AND league_id IS NULL
      AND (
        (tournament_id IS NOT NULL AND start_at + INTERVAL '24 hours' <= NOW())
        OR
        (tournament_id IS NULL     AND start_at + INTERVAL '12 hours' <= NOW())
      )
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
      (v_match.id, 'in_progress', 'finished_no_result', 'system',
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

  -- 3. Reminder 24h before (solo partidas sueltas; las de liga/torneo no usan
  --    start_at como hora real de juego)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND tournament_id IS NULL
      AND league_id IS NULL
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

  -- 4. Reminder 2h before (solo partidas sueltas)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'planned'
      AND tournament_id IS NULL
      AND league_id IS NULL
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

  -- 5. Reminder 5h in_progress (solo partidas sueltas y torneos;
  --    las de liga pueden durar dias)
  FOR v_match IN
    SELECT id, title, start_at FROM public.matches
    WHERE status   = 'in_progress'
      AND league_id IS NULL
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

-- =========================================================================
-- 3. Modificar submit_match_result: auto-iniciar partidas de liga "planned"
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id UUID,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS public.match_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_team TEXT;
  v_status TEXT;
  v_from_status TEXT;
  v_row public.match_results%ROWTYPE;
  v_needs_validation BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  -- Las partidas de liga "planned" se auto-inician al recibir un resultado.
  -- Las partidas sueltas "planned" deben iniciarse manualmente primero.
  IF v_match.status = 'planned' THEN
    IF v_match.league_id IS NULL THEN
      RAISE EXCEPTION 'invalid_match_status';
    END IF;
    UPDATE public.matches
      SET status = 'in_progress',
          start_at = COALESCE(start_at, NOW()),
          updated_at = NOW()
    WHERE id = p_match_id;
    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, user_id, reason)
    VALUES
      (p_match_id, 'planned', 'in_progress', 'user', auth.uid(),
       'Auto-started on result submission (league)');
    v_match.status := 'in_progress';
  END IF;

  IF v_match.status NOT IN ('in_progress', 'finished_no_result') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  PERFORM public.validate_match_scores(p_team_a_games, p_team_b_games, v_match.duration_target_games);

  IF EXISTS (
    SELECT 1 FROM public.match_results mr
    WHERE mr.match_id = p_match_id AND mr.status IN ('pending_validation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'result_already_exists';
  END IF;

  SELECT mp.team INTO v_team
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL
  LIMIT 1;

  IF v_team IS NULL THEN RAISE EXCEPTION 'not_participant'; END IF;

  v_needs_validation := public.rival_team_has_registered_participant(p_match_id, v_team);
  v_status := CASE WHEN v_needs_validation THEN 'pending_validation' ELSE 'confirmed' END;

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games,
    submitted_by_team, submitted_by_user_id, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games,
    v_team, auth.uid(), v_status
  )
  RETURNING * INTO v_row;

  IF NOT v_needs_validation THEN
    v_from_status := v_match.status;
    PERFORM set_config('app.suppress_match_change_notify', '1', true);
    UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;
    PERFORM set_config('app.suppress_match_change_notify', '0', true);

    INSERT INTO public.match_state_transitions (
      match_id, from_status, to_status, triggered_by, user_id, reason
    ) VALUES (
      p_match_id, v_from_status, 'finished', 'user', auth.uid(),
      'Resultado confirmado (rival solo texto)'
    );

    IF v_match.tournament_id IS NOT NULL THEN
      PERFORM public.advance_tournament_round(p_match_id);
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.process_match_state_transitions IS
  'Cron cada minuto. Torneos: 24h sin resultado -> finished_no_result. Ligas: sin timeout automatico (fixtures se quedan planned hasta jugarse). Partidas sueltas: 12h.';

COMMENT ON FUNCTION public.submit_match_result IS
  'Registra resultado. Las partidas de liga en estado planned se auto-inician al recibir el resultado.';
