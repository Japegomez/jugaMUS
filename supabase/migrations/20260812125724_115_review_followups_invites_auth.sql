-- 115: Idempotent re-apply of invite auth/capacity follow-ups (already in 114).
-- Kept as a separate version to match the remote migration history.

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

CREATE OR REPLACE FUNCTION public.list_match_invitations(p_match_id UUID)
RETURNS TABLE (
  invitation_id UUID,
  invitee_id    UUID,
  invitee_name  TEXT,
  team          TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        m.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.match_participants mp
          WHERE mp.match_id = m.id
            AND mp.user_id = auth.uid()
            AND mp.state = 'confirmed'
            AND mp.left_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM public.match_invitations mi
          WHERE mi.match_id = m.id
            AND mi.invitee_id = auth.uid()
            AND mi.status = 'pending'
        )
      )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    mi.id AS invitation_id,
    mi.invitee_id,
    p.display_name AS invitee_name,
    mi.team,
    mi.status,
    mi.created_at
  FROM public.match_invitations mi
  JOIN public.profiles p ON p.id = mi.invitee_id
  WHERE mi.match_id = p_match_id
  ORDER BY mi.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_effective_roster_filled(p_match_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT LEAST(
    4,
    public.match_registered_slots_filled(p_match_id)
      + public.match_text_slots_filled(m)
      + public.match_pending_invitations_filled(p_match_id)
  )
  FROM public.matches m
  WHERE m.id = p_match_id;
$$;

REVOKE ALL ON FUNCTION public.match_effective_roster_filled(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_effective_roster_filled(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.match_effective_roster_filled(UUID) FROM authenticated;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, city, photo_url, badge_showcase, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, notify_on_friend_request, notify_on_match_invitation,
  role, status, created_at, updated_at
) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, phone_e164, city, photo_url, badge_showcase, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, notify_on_friend_request, notify_on_match_invitation,
  push_token
) ON public.profiles TO authenticated;
