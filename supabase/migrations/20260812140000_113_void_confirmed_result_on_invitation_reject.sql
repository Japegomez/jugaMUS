-- When a match is cancelled (incl. invitation reject after a confirmed result),
-- void any active result rows and refresh participant stats aggregates.

CREATE OR REPLACE FUNCTION public.fn_void_pending_results_on_match_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_had_confirmed BOOLEAN := FALSE;
  v_uid UUID;
BEGIN
  IF NEW.status = 'cancelled'
     AND (TG_OP = 'UPDATE')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.match_results mr
      WHERE mr.match_id = NEW.id
        AND mr.status = 'confirmed'
    ) INTO v_had_confirmed;

    UPDATE public.match_results mr
    SET status = 'void', updated_at = NOW()
    WHERE mr.match_id = NEW.id
      AND mr.status IN ('pending_validation', 'confirmed', 'disputed');

    -- Confirmed results already affected aggregates; rebuild without this match.
    IF v_had_confirmed THEN
      FOR v_uid IN
        SELECT DISTINCT mp.user_id
        FROM public.match_participants mp
        WHERE mp.match_id = NEW.id
          AND mp.state = 'confirmed'
          AND mp.user_id IS NOT NULL
      LOOP
        PERFORM public.enqueue_player_stats_recompute(v_uid);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_match_invitation(
  p_invitation_id UUID,
  p_accept BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   public.match_invitations%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_existing public.match_participants%ROWTYPE;
  v_inviter_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_inv
  FROM public.match_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.invitee_id <> auth.uid() THEN RAISE EXCEPTION 'not_invitee'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_inv.match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF NOT p_accept THEN
    UPDATE public.match_invitations
      SET status = 'rejected', responded_at = NOW()
      WHERE id = p_invitation_id;

    -- Rejecting frees the slot. If the match has already started/finished,
    -- cancel it. The cancel trigger voids pending/confirmed/disputed results.
    IF v_match.status IN ('in_progress', 'finished', 'finished_no_result') THEN
      PERFORM set_config('app.suppress_match_change_notify', '1', true);
      UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
        WHERE id = v_match.id;
      PERFORM set_config('app.suppress_match_change_notify', '0', true);

      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, user_id, reason)
      VALUES
        (v_match.id, v_match.status, 'cancelled', 'user', auth.uid(),
         'invitation_rejected');

      PERFORM public.enqueue_notification(
        p_user_id       := mp.user_id,
        p_type          := 'match_cancelled',
        p_title         := 'Partida cancelada',
        p_body          := 'La partida «' || v_match.title || '» ha sido cancelada',
        p_payload_json  := jsonb_build_object('match_id', v_match.id)
      )
      FROM public.match_participants mp
      WHERE mp.match_id = v_match.id
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
        AND mp.user_id <> auth.uid();
    END IF;
    RETURN;
  END IF;

  IF NOT public.inviter_team_capacity_available(v_inv.match_id, v_inv.team) THEN
    RAISE EXCEPTION 'team_capacity_exceeded';
  END IF;

  SELECT * INTO v_existing FROM public.match_participants
  WHERE match_id = v_inv.match_id AND user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.match_participants
      SET team = v_inv.team, state = 'confirmed', left_at = NULL, joined_at = NOW()
      WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.match_participants (match_id, user_id, team, state)
    VALUES (v_inv.match_id, auth.uid(), v_inv.team, 'confirmed');
  END IF;

  UPDATE public.match_invitations
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_invitation_id;

  SELECT display_name INTO v_inviter_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.enqueue_notification(
    p_user_id       := v_inv.inviter_id,
    p_type          := 'participant_joined',
    p_title         := 'Nuevo jugador en tu partida',
    p_body          := COALESCE(v_inviter_name, 'Alguien') || ' ha aceptado tu invitación a «' || v_match.title || '»',
    p_payload_json  := jsonb_build_object('match_id', v_match.id, 'user_id', auth.uid())
  );
END;
$$;
