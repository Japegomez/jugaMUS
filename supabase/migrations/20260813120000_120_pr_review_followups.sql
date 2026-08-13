-- 120: PR review follow-ups (applied 108–119 already live; do not edit those files).
-- - Count pending invitations as SECURITY DEFINER (not filtered by caller RLS).
-- - Search by lower(display_name) to match profiles_display_name_trgm_idx.
-- - Recreate list_my_match_invitations with DROP + REVOKE/GRANT.
-- - Idempotent realtime publication adds.
-- - join_private_match respects pending-invite team capacity.
-- - Friend-request cooldown only for the original requester.

CREATE OR REPLACE FUNCTION public.match_pending_invitations_filled(p_match_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::integer
  FROM public.match_invitations mi
  WHERE mi.match_id = p_match_id
    AND mi.status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.match_pending_invitations_filled(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_pending_invitations_filled(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.match_pending_invitations_filled(UUID) FROM authenticated;

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
    AND lower(p.display_name) LIKE lower(v_pattern) ESCAPE '\'
  ORDER BY
    CASE WHEN lower(p.display_name) = lower(v_q) THEN 0 ELSE 1 END,
    p.display_name
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users_by_display_name(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users_by_display_name(TEXT, INT) TO authenticated;

DROP FUNCTION IF EXISTS public.list_my_match_invitations();

CREATE FUNCTION public.list_my_match_invitations()
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

REVOKE ALL ON FUNCTION public.list_my_match_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_match_invitations() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_invitations;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.join_private_match(
  p_match_id UUID,
  p_team      TEXT,
  p_password  TEXT
)
RETURNS public.match_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_match   public.matches%ROWTYPE;
  v_existing public.match_participants%ROWTYPE;
  v_row      public.match_participants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_match';
  END IF;

  IF v_match.status NOT IN ('planned', 'in_progress') THEN
    RAISE EXCEPTION 'match_not_joinable';
  END IF;

  IF v_match.tournament_id IS NOT NULL THEN
    RAISE EXCEPTION 'tournament_match';
  END IF;

  IF v_match.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'league_match';
  END IF;

  IF v_match.password_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_match.password_hash) <> v_match.password_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  SELECT * INTO v_existing
  FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existing.left_at IS NULL AND v_existing.state = 'confirmed' THEN
      RAISE EXCEPTION 'already_participant';
    END IF;

    IF NOT public.inviter_team_capacity_available(p_match_id, p_team) THEN
      RAISE EXCEPTION 'team_capacity_exceeded';
    END IF;

    UPDATE public.match_participants
    SET
      team      = p_team,
      state     = 'confirmed',
      left_at   = NULL,
      joined_at = NOW()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    IF NOT public.inviter_team_capacity_available(p_match_id, p_team) THEN
      RAISE EXCEPTION 'team_capacity_exceeded';
    END IF;

    INSERT INTO public.match_participants (match_id, user_id, team)
    VALUES (p_match_id, auth.uid(), p_team)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_private_match(UUID, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.send_friend_request(UUID, TEXT);

CREATE FUNCTION public.send_friend_request(
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
       AND v_row.requester_id = v_self
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
