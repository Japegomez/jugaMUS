-- 110: Remove-friend RPC + notification preferences for friend/match-invitation alerts.

-- ── New profile preference columns ────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_on_friend_request BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_match_invitation BOOLEAN NOT NULL DEFAULT TRUE;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, city, photo_url, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, notify_on_friend_request, notify_on_match_invitation,
  role, status, created_at, updated_at
) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, phone_e164, city, photo_url, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, notify_on_friend_request, notify_on_match_invitation,
  push_token
) ON public.profiles TO authenticated;

-- ── enqueue_notification: gate the two new notification types ─────────────────

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload_json JSONB DEFAULT NULL,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push BOOLEAN;
  v_join BOOLEAN;
  v_start BOOLEAN;
  v_edit BOOLEAN;
  v_cancel BOOLEAN;
  v_result BOOLEAN;
  v_rem_24h BOOLEAN;
  v_rem_2h BOOLEAN;
  v_rem_ip BOOLEAN;
  v_friend_req BOOLEAN;
  v_match_inv BOOLEAN;
  v_allowed BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_type IS NULL THEN
    RETURN;
  END IF;

  SELECT
    p.notify_push,
    p.notify_on_join,
    p.notify_on_match_start,
    p.notify_on_match_edit,
    p.notify_on_match_cancel,
    p.notify_on_result,
    p.notify_on_reminder_24h,
    p.notify_on_reminder_2h,
    p.notify_on_reminder_in_progress,
    p.notify_on_friend_request,
    p.notify_on_match_invitation
  INTO
    v_push,
    v_join,
    v_start,
    v_edit,
    v_cancel,
    v_result,
    v_rem_24h,
    v_rem_2h,
    v_rem_ip,
    v_friend_req,
    v_match_inv
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR NOT COALESCE(v_push, FALSE) THEN
    RETURN;
  END IF;

  v_allowed := CASE p_type
    WHEN 'participant_joined' THEN v_join
    WHEN 'match_started' THEN v_start
    WHEN 'match_updated' THEN v_edit
    WHEN 'match_finished_no_result' THEN v_edit
    WHEN 'match_cancelled' THEN v_cancel
    WHEN 'match_cancelled_insufficient' THEN v_cancel
    WHEN 'tournament_cancelled' THEN v_cancel
    WHEN 'result_pending_validation' THEN v_result
    WHEN 'reminder_24h' THEN v_rem_24h
    WHEN 'reminder_2h' THEN v_rem_2h
    WHEN 'reminder_5h_in_progress' THEN v_rem_ip
    WHEN 'friend_request_received' THEN v_friend_req
    WHEN 'match_invitation_received' THEN v_match_inv
    ELSE TRUE
  END;

  IF NOT COALESCE(v_allowed, FALSE) THEN
    RETURN;
  END IF;

  INSERT INTO public.notification_queue (user_id, type, title, body, payload_json, scheduled_for)
  VALUES (p_user_id, p_type, p_title, p_body, p_payload_json, p_scheduled_for);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM authenticated;

-- ── remove_friend: either party deletes an accepted friendship ─────────────────

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
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
