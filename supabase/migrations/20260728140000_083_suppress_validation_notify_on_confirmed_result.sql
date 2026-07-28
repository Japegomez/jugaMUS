-- 083: Do not send "Validar resultado" notification when the result is already
-- confirmed at insert time (e.g. referee record or text-only match).

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
  -- Only notify the rival team when they actually need to validate.
  IF NEW.status <> 'pending_validation' THEN
    RETURN NEW;
  END IF;

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
      p_body         := 'El equipo contrario ha registrado el resultado de «' || v_match.title
        || '». Revísalo y confírmalo o disputa.',
      p_payload_json := jsonb_build_object('match_id', NEW.match_id, 'match_result_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;
