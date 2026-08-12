-- 108: Friendships + friend requests (with optional message).
--   - One row per unordered user pair (LEAST/GREATEST unique index).
--   - Status lifecycle: pending -> accepted | rejected ; pending -> cancelled (by requester).
--   - Re-sending after rejected/cancelled reopens the same row.
--   - Writes only via SECURITY DEFINER RPCs (direct writes revoked).

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships (requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON public.friendships (addressee_id, status, created_at DESC);

-- One relationship per unordered pair of users.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_friendships_pair
  ON public.friendships (LEAST(requester_id, addressee_id),
                         GREATEST(requester_id, addressee_id));

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendships_select_party ON public.friendships
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR addressee_id = auth.uid()
    OR public.auth_is_admin()
  );

-- Direct writes are revoked below; only the RPCs may mutate this table.

-- ── RPC: send (or re-send) a friend request ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_addressee_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self   UUID := auth.uid();
  v_row    public.friendships%ROWTYPE;
  v_name   TEXT;
BEGIN
  IF v_self IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_addressee_id IS NULL THEN RAISE EXCEPTION 'addressee_required'; END IF;
  IF p_addressee_id = v_self THEN RAISE EXCEPTION 'cannot_friend_self'; END IF;

  -- Addressee must exist and be active.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_addressee_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'addressee_not_found';
  END IF;

  SELECT * INTO v_row
  FROM public.friendships
  WHERE LEAST(requester_id, addressee_id) = LEAST(v_self, p_addressee_id)
    AND GREATEST(requester_id, addressee_id) = GREATEST(v_self, p_addressee_id);

  IF FOUND THEN
    IF v_row.status = 'accepted' THEN
      RAISE EXCEPTION 'already_friends';
    END IF;
    IF v_row.status = 'pending' THEN
      -- If the OTHER side is the requester, accept instead of erroring.
      IF v_row.requester_id = p_addressee_id THEN
        UPDATE public.friendships
          SET status = 'accepted', responded_at = NOW()
          WHERE id = v_row.id;
        RETURN v_row.id;
      END IF;
      RAISE EXCEPTION 'request_already_pending';
    END IF;
    -- rejected or cancelled: reopen as a fresh pending request from self.
    UPDATE public.friendships
      SET requester_id = v_self,
          addressee_id = p_addressee_id,
          message     = NULLIF(BTRIM(COALESCE(p_message, '')), ''),
          status      = 'pending',
          created_at  = NOW(),
          responded_at = NULL
      WHERE id = v_row.id;
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id, message)
    VALUES (v_self, p_addressee_id, NULLIF(BTRIM(COALESCE(p_message, '')), ''))
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

  RETURN v_row.id;
END;
$$;

-- ── RPC: respond to a friend request (accept / reject) ────────────────────────

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_friendship_id UUID,
  p_accept BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.friendships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.friendships WHERE id = p_friendship_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'friendship_not_found'; END IF;
  IF v_row.addressee_id <> auth.uid() THEN RAISE EXCEPTION 'not_addressee'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  UPDATE public.friendships
    SET status       = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
        responded_at = NOW()
    WHERE id = p_friendship_id;
END;
$$;

-- ── RPC: cancel a sent pending request ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_friendship_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.friendships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.friendships WHERE id = p_friendship_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'friendship_not_found'; END IF;
  IF v_row.requester_id <> auth.uid() THEN RAISE EXCEPTION 'not_requester'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  UPDATE public.friendships SET status = 'cancelled', responded_at = NOW()
    WHERE id = p_friendship_id;
END;
$$;

-- ── RPC: list my confirmed friends ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_my_friends()
RETURNS TABLE (
  user_id    UUID,
  display_name TEXT,
  city       TEXT,
  photo_url  TEXT,
  since      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS user_id,
    p.display_name,
    p.city,
    p.photo_url,
    COALESCE(f.responded_at, f.created_at) AS since
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  ORDER BY p.display_name;
$$;

-- ── RPC: list my friend requests (sent or received, pending only) ─────────────

CREATE OR REPLACE FUNCTION public.list_my_friend_requests(p_direction TEXT)
RETURNS TABLE (
  friendship_id UUID,
  user_id      UUID,
  display_name TEXT,
  city         TEXT,
  photo_url    TEXT,
  message      TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id AS friendship_id,
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS user_id,
    p.display_name,
    p.city,
    p.photo_url,
    f.message,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'pending'
    AND (
      (p_direction = 'sent'     AND f.requester_id = auth.uid())
      OR
      (p_direction = 'received' AND f.addressee_id = auth.uid())
    )
  ORDER BY f.created_at DESC;
$$;

-- ── RPC: friendship status between me and another user (for the profile button) ─

CREATE OR REPLACE FUNCTION public.get_friendship_with_user(p_other_user_id UUID)
RETURNS TABLE (
  friendship_id UUID,
  status        TEXT,
  direction     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id AS friendship_id,
    f.status,
    CASE
      WHEN f.requester_id = auth.uid() THEN 'sent'
      WHEN f.addressee_id = auth.uid() THEN 'received'
    END AS direction
  FROM public.friendships f
  WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(auth.uid(), p_other_user_id)
    AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(auth.uid(), p_other_user_id)
  LIMIT 1;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.send_friend_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_friends() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_friends() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_friend_requests(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_friend_requests(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_friendship_with_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friendship_with_user(UUID) TO authenticated;

-- Revoke direct writes to the table; only RPCs (SECURITY DEFINER) mutate it.
REVOKE INSERT, UPDATE, DELETE ON public.friendships FROM authenticated;
GRANT SELECT ON public.friendships TO authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
