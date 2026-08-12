-- 117: Live follow-ups after review (escape search, match_status, prefs, slim phone RPC).

-- Escape ILIKE wildcards in user search + trigram index.
CREATE OR REPLACE FUNCTION public.search_users_by_display_name(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  city TEXT,
  photo_url TEXT,
  friendship_status TEXT,
  friendship_direction TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self UUID := auth.uid();
  v_q TEXT := NULLIF(BTRIM(COALESCE(p_query, '')), '');
  v_pattern TEXT;
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 30);
BEGIN
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_q IS NULL OR char_length(v_q) < 2 THEN
    RETURN;
  END IF;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.city,
    p.photo_url,
    f.status AS friendship_status,
    CASE
      WHEN f.id IS NULL THEN NULL
      WHEN f.requester_id = v_self THEN 'sent'
      WHEN f.addressee_id = v_self THEN 'received'
      ELSE NULL
    END AS friendship_direction
  FROM public.profiles p
  LEFT JOIN public.friendships f
    ON f.status IN ('pending', 'accepted')
   AND LEAST(f.requester_id, f.addressee_id) = LEAST(v_self, p.id)
   AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_self, p.id)
  WHERE p.status = 'active'
    AND p.id <> v_self
    AND p.display_name ILIKE v_pattern ESCAPE '\'
  ORDER BY
    CASE WHEN lower(p.display_name) = lower(v_q) THEN 0 ELSE 1 END,
    p.display_name
  LIMIT v_limit;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles
  USING gin (lower(display_name) gin_trgm_ops)
  WHERE status = 'active';

-- Rename list_my_match_invitations.status → match_status.
DROP FUNCTION IF EXISTS public.list_my_match_invitations();

CREATE OR REPLACE FUNCTION public.list_my_match_invitations()
RETURNS TABLE (
  invitation_id UUID,
  match_id      UUID,
  title         TEXT,
  start_at      TIMESTAMPTZ,
  match_status  TEXT,
  inviter_id    UUID,
  inviter_name  TEXT,
  team          TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mi.id AS invitation_id,
    mi.match_id,
    m.title,
    m.start_at,
    m.status AS match_status,
    mi.inviter_id,
    p.display_name AS inviter_name,
    mi.team,
    mi.created_at
  FROM public.match_invitations mi
  JOIN public.matches m ON m.id = mi.match_id
  JOIN public.profiles p ON p.id = mi.inviter_id
  WHERE mi.invitee_id = auth.uid()
    AND mi.status = 'pending'
    AND m.status <> 'cancelled'
  ORDER BY mi.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_match_invitations() TO authenticated;

-- Prefer friend_request_accepted for auto-accept notifications.
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
    WHEN 'friend_request_accepted' THEN v_friend_req
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

-- Re-apply concurrency-safe send_friend_request + slim phone profile.
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
    BEGIN
      INSERT INTO public.friendships (requester_id, addressee_id, message)
      VALUES (v_self, p_addressee_id, v_msg)
      RETURNING * INTO v_row;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO v_row
        FROM public.friendships
        WHERE LEAST(requester_id, addressee_id) = LEAST(v_self, p_addressee_id)
          AND GREATEST(requester_id, addressee_id) = GREATEST(v_self, p_addressee_id);
        IF v_row.status = 'accepted' THEN
          RAISE EXCEPTION 'already_friends';
        END IF;
        RAISE EXCEPTION 'request_already_pending';
    END;
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

DROP FUNCTION IF EXISTS public.get_profile_with_phone(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_profile_with_phone(
  p_match_id UUID,
  p_profile_id UUID
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  city TEXT,
  photo_url TEXT,
  phone_e164 TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.city,
    p.photo_url,
    p.phone_e164
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM public.match_participants me
      WHERE me.match_id = p_match_id AND me.user_id = auth.uid() AND me.state = 'confirmed'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_participants them
      WHERE them.match_id = p_match_id AND them.user_id = p_profile_id AND them.state = 'confirmed'
    );
$$;

REVOKE ALL ON FUNCTION public.get_profile_with_phone(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_with_phone(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_with_phone(UUID, UUID) TO authenticated;
