-- 116: concurrency-safe send_friend_request + slim get_profile_with_phone.

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
