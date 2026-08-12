-- 114: Review follow-ups for friendships + match invitations security/behavior.

-- Cooldown after rejection + auto-accept notification + message length.
DROP FUNCTION IF EXISTS public.send_friend_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_addressee_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS TABLE (friendship_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self   UUID := auth.uid();
  v_row    public.friendships%ROWTYPE;
  v_name   TEXT;
  v_msg    TEXT := NULLIF(BTRIM(LEFT(COALESCE(p_message, ''), 200)), '');
BEGIN
  IF v_self IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_addressee_id IS NULL THEN RAISE EXCEPTION 'addressee_required'; END IF;
  IF p_addressee_id = v_self THEN RAISE EXCEPTION 'cannot_friend_self'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_addressee_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'addressee_not_found';
  END IF;

  SELECT * INTO v_row
  FROM public.friendships
  WHERE LEAST(requester_id, addressee_id) = LEAST(v_self, p_addressee_id)
    AND GREATEST(requester_id, addressee_id) = GREATEST(v_self, p_addressee_id)
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'accepted' THEN
      RAISE EXCEPTION 'already_friends';
    END IF;
    IF v_row.status = 'pending' THEN
      IF v_row.requester_id = p_addressee_id THEN
        UPDATE public.friendships
          SET status = 'accepted', responded_at = NOW()
          WHERE id = v_row.id
          RETURNING * INTO v_row;

        SELECT display_name INTO v_name FROM public.profiles WHERE id = v_self;
        -- Notify the original requester that we accepted their pending request.
        PERFORM public.enqueue_notification(
          p_user_id       := p_addressee_id,
          p_type          := 'friend_request_accepted',
          p_title         := 'Solicitud aceptada',
          p_body          := COALESCE(v_name, 'Alguien') || ' ha aceptado tu solicitud de amistad',
          p_payload_json  := jsonb_build_object('friendship_id', v_row.id, 'user_id', v_self)
        );
        friendship_id := v_row.id;
        status := v_row.status;
        RETURN NEXT;
        RETURN;
      END IF;
      RAISE EXCEPTION 'request_already_pending';
    END IF;

    -- Rejected recently: require cooldown before reopen.
    IF v_row.status = 'rejected'
       AND v_row.responded_at IS NOT NULL
       AND v_row.responded_at > NOW() - INTERVAL '7 days'
    THEN
      RAISE EXCEPTION 'request_recently_rejected';
    END IF;

    UPDATE public.friendships
      SET requester_id = v_self,
          addressee_id = p_addressee_id,
          message     = v_msg,
          status      = 'pending',
          created_at  = NOW(),
          responded_at = NULL
      WHERE id = v_row.id
      RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id, message)
    VALUES (v_self, p_addressee_id, v_msg)
    RETURNING * INTO v_row;
  END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_self;

  PERFORM public.enqueue_notification(
    p_user_id       := p_addressee_id,
    p_type          := 'friend_request_received',
    p_title         := 'Nueva solicitud de amistad',
    p_body          := COALESCE(v_name, 'Alguien') || ' quiere ser tu amigo en jugaMUS',
    p_payload_json  := jsonb_build_object('friendship_id', v_row.id, 'requester_id', v_self)
  );

  friendship_id := v_row.id;
  status := v_row.status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID, TEXT) TO authenticated;

ALTER TABLE public.friendships
  DROP CONSTRAINT IF EXISTS friendships_message_len_chk;
ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_message_len_chk
  CHECK (message IS NULL OR char_length(message) <= 200) NOT VALID;
ALTER TABLE public.friendships
  VALIDATE CONSTRAINT friendships_message_len_chk;

REVOKE INSERT, UPDATE, DELETE ON public.friendships FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.friendships FROM anon;

-- remove_friend also cancels pending match invitations between the pair.
CREATE OR REPLACE FUNCTION public.remove_friend(p_other_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self UUID := auth.uid();
BEGIN
  IF v_self IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_other_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF p_other_user_id = v_self THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;

  DELETE FROM public.friendships
  WHERE status = 'accepted'
    AND LEAST(requester_id, addressee_id) = LEAST(v_self, p_other_user_id)
    AND GREATEST(requester_id, addressee_id) = GREATEST(v_self, p_other_user_id);

  IF NOT FOUND THEN RAISE EXCEPTION 'friendship_not_found'; END IF;

  UPDATE public.match_invitations
    SET status = 'cancelled', responded_at = NOW()
  WHERE status = 'pending'
    AND (
      (inviter_id = v_self AND invitee_id = p_other_user_id)
      OR (inviter_id = p_other_user_id AND invitee_id = v_self)
    );
END;
$$;

-- Match invitation respond: lock invite row + capacity check on accept.
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

-- Authorize list_match_invitations to match parties / creator.
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

-- Restore badge_showcase on profile column grants after migration 110.
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
