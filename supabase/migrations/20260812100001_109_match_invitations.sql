-- 109: Match invitations for friends.
--   - Pending invitation occupies a roster slot (so a planned match with
--     pending invites starts at start_at and is not auto-cancelled).
--   - Rejecting frees the slot; if the match is already in_progress/finished/
--     finished_no_result the match is cancelled (even with a pending result).
--   - Result submission creates a pending_validation result when the rival
--     team has a registered participant OR a pending/accepted invitation.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  inviter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team         TEXT NOT NULL CHECK (team IN ('A', 'B')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (inviter_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_match_invitations_match
  ON public.match_invitations (match_id, status);
CREATE INDEX IF NOT EXISTS idx_match_invitations_invitee
  ON public.match_invitations (invitee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_invitations_inviter
  ON public.match_invitations (inviter_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_match_invitations_pending
  ON public.match_invitations (match_id, invitee_id)
  WHERE status = 'pending';

ALTER TABLE public.match_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_invitations_select_party ON public.match_invitations
  FOR SELECT TO authenticated
  USING (
    inviter_id = auth.uid()
    OR invitee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_id
        AND mp.user_id = auth.uid()
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
    )
    OR public.auth_is_admin()
  );

REVOKE INSERT, UPDATE, DELETE ON public.match_invitations FROM authenticated;
GRANT SELECT ON public.match_invitations TO authenticated;

-- ── Helper: pending invitations count as roster slots ──────────────────────────

CREATE OR REPLACE FUNCTION public.match_pending_invitations_filled(p_match_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::integer
  FROM public.match_invitations mi
  WHERE mi.match_id = p_match_id
    AND mi.status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.match_effective_roster_filled(p_match_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
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

-- ── Helper: rival team has a registered participant OR a pending/accepted
--    invitation to a registered user (drives pending_validation). ──────────────

CREATE OR REPLACE FUNCTION public.rival_team_has_registered_participant(
  p_match_id UUID,
  p_submitted_by_team TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.match_participants mp
      WHERE mp.match_id = p_match_id
        AND mp.team <> p_submitted_by_team
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.match_invitations mi
      WHERE mi.match_id = p_match_id
        AND mi.team <> p_submitted_by_team
        AND mi.status IN ('pending', 'accepted')
    );
$$;

-- ── Helper: is there room for one more pending invite on a team? ──────────────

CREATE OR REPLACE FUNCTION public.inviter_team_capacity_available(
  p_match_id UUID,
  p_team TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (
    (SELECT COUNT(*)::int FROM public.match_participants mp
       WHERE mp.match_id = p_match_id AND mp.team = p_team
         AND mp.state = 'confirmed' AND mp.left_at IS NULL)
    +
    (CASE WHEN p_team = 'A' THEN
       (CASE WHEN NULLIF(BTRIM(m.team_a_player_1), '') IS NOT NULL THEN 1 ELSE 0 END)
       + (CASE WHEN NULLIF(BTRIM(m.team_a_player_2), '') IS NOT NULL THEN 1 ELSE 0 END)
     ELSE
       (CASE WHEN NULLIF(BTRIM(m.team_b_player_1), '') IS NOT NULL THEN 1 ELSE 0 END)
       + (CASE WHEN NULLIF(BTRIM(m.team_b_player_2), '') IS NOT NULL THEN 1 ELSE 0 END)
     END)
    +
    (SELECT COUNT(*)::int FROM public.match_invitations mi
       WHERE mi.match_id = p_match_id AND mi.team = p_team
         AND mi.status = 'pending')
  ) < 2
  FROM public.matches m
  WHERE m.id = p_match_id;
$$;

-- ── RPC: invite a friend to a match team ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_friend_to_match(
  p_match_id UUID,
  p_invitee_id UUID,
  p_team TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match   public.matches%ROWTYPE;
  v_self    UUID := auth.uid();
  v_row     public.match_invitations%ROWTYPE;
  v_name    TEXT;
BEGIN
  IF v_self IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_invitee_id IS NULL THEN RAISE EXCEPTION 'invitee_required'; END IF;
  IF p_team NOT IN ('A', 'B') THEN RAISE EXCEPTION 'invalid_team'; END IF;
  IF p_invitee_id = v_self THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF v_match.tournament_id IS NOT NULL OR v_match.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'not_standalone_match';
  END IF;
  IF v_match.creator_id <> v_self THEN RAISE EXCEPTION 'not_creator'; END IF;
  IF v_match.status NOT IN ('planned', 'in_progress') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  -- Must be confirmed friends.
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND LEAST(f.requester_id, f.addressee_id) = LEAST(v_self, p_invitee_id)
      AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_self, p_invitee_id)
  ) THEN
    RAISE EXCEPTION 'not_friends';
  END IF;

  -- Invitee must not already be a confirmed participant.
  IF EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = p_match_id AND mp.user_id = p_invitee_id
      AND mp.state = 'confirmed' AND mp.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_participant';
  END IF;

  -- Team capacity (confirmed + text + pending < 2).
  IF NOT public.inviter_team_capacity_available(p_match_id, p_team) THEN
    RAISE EXCEPTION 'team_capacity_exceeded';
  END IF;

  -- Re-open a previously rejected/cancelled invitation, or accept a pending one.
  SELECT * INTO v_row FROM public.match_invitations
  WHERE match_id = p_match_id AND invitee_id = p_invitee_id
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_row.status = 'pending' THEN
      RAISE EXCEPTION 'invitation_already_pending';
    END IF;
    IF v_row.status = 'accepted' THEN
      RAISE EXCEPTION 'invitation_already_accepted';
    END IF;
    UPDATE public.match_invitations
      SET team = p_team, status = 'pending',
          created_at = NOW(), responded_at = NULL
      WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.match_invitations (match_id, inviter_id, invitee_id, team)
    VALUES (p_match_id, v_self, p_invitee_id, p_team)
    RETURNING * INTO v_row;
  END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_self;

  PERFORM public.enqueue_notification(
    p_user_id       := p_invitee_id,
    p_type          := 'match_invitation_received',
    p_title         := 'Te han invitado a una partida',
    p_body          := COALESCE(v_name, 'Alguien') || ' te ha invitado a la partida «' || v_match.title || '»',
    p_payload_json  := jsonb_build_object('match_id', p_match_id, 'invitation_id', v_row.id)
  );

  RETURN v_row.id;
END;
$$;

-- ── RPC: respond to a match invitation (accept / reject) ──────────────────────

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

  SELECT * INTO v_inv FROM public.match_invitations WHERE id = p_invitation_id;
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
    -- the now-incomplete roster cancels the match (even with a pending result).
    IF v_match.status IN ('in_progress', 'finished', 'finished_no_result') THEN
      PERFORM set_config('app.suppress_match_change_notify', '1', true);
      UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
        WHERE id = v_match.id;
      PERFORM set_config('app.suppress_match_change_notify', '0', true);

      -- Void any pending_validation result.
      UPDATE public.match_results SET status = 'void'
        WHERE match_id = v_match.id AND status = 'pending_validation';

      INSERT INTO public.match_state_transitions
        (match_id, from_status, to_status, triggered_by, user_id, reason)
      VALUES
        (v_match.id, v_match.status, 'cancelled', 'user', auth.uid(),
         'invitation_rejected');

      -- Notify confirmed participants (other than the rejecter).
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

  -- Accept: join the team as a confirmed participant.
  SELECT * INTO v_existing FROM public.match_participants
  WHERE match_id = v_inv.match_id AND user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    -- Re-join an existing (left) row.
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

-- ── RPC: cancel a sent pending invitation (inviter, planned only) ─────────────

CREATE OR REPLACE FUNCTION public.cancel_match_invitation(p_invitation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   public.match_invitations%ROWTYPE;
  v_match public.matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_inv FROM public.match_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.inviter_id <> auth.uid() THEN RAISE EXCEPTION 'not_inviter'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = v_inv.match_id;
  IF v_match.status <> 'planned' THEN RAISE EXCEPTION 'match_already_started'; END IF;

  UPDATE public.match_invitations
    SET status = 'cancelled', responded_at = NOW()
    WHERE id = p_invitation_id;
END;
$$;

-- ── RPC: list pending invitations received by me ──────────────────────────────

CREATE OR REPLACE FUNCTION public.list_my_match_invitations()
RETURNS TABLE (
  invitation_id UUID,
  match_id      UUID,
  title         TEXT,
  start_at      TIMESTAMPTZ,
  status        TEXT,
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
    m.status,
    mi.inviter_id,
    p.display_name AS inviter_name,
    mi.team,
    mi.created_at
  FROM public.match_invitations mi
  JOIN public.matches m ON m.id = mi.match_id
  JOIN public.profiles p ON p.id = mi.inviter_id
  WHERE mi.invitee_id = auth.uid()
    AND mi.status = 'pending'
  ORDER BY mi.created_at DESC;
$$;

-- ── RPC: list invitations for a match (for the match detail banner/chips) ─────

CREATE OR REPLACE FUNCTION public.list_match_invitations(p_match_id UUID)
RETURNS TABLE (
  invitation_id UUID,
  invitee_id    UUID,
  invitee_name  TEXT,
  team          TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ── Trigger: when a match is cancelled, cancel its pending invitations ─────────

CREATE OR REPLACE FUNCTION public.fn_cancel_pending_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.match_invitations
      SET status = 'cancelled', responded_at = NOW()
      WHERE match_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_pending_invitations ON public.matches;
CREATE TRIGGER trg_cancel_pending_invitations
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cancel_pending_invitations();

-- ── Grants ─────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.invite_friend_to_match(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_friend_to_match(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_match_invitation(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_match_invitation(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_match_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_match_invitation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_match_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_match_invitations() TO authenticated;

REVOKE ALL ON FUNCTION public.list_match_invitations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_match_invitations(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.match_pending_invitations_filled(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inviter_team_capacity_available(UUID, TEXT) FROM PUBLIC;

-- ── Guard record_match_result_direct: no pending/accepted rival invites ───────
-- A creator may close a past match directly only when the rival team has no
-- registered participant and no pending/accepted invitation. Otherwise the
-- result must go through submit_match_result (pending_validation).

CREATE OR REPLACE FUNCTION public.record_match_result_direct(
  p_match_id UUID,
  p_team_a_games INT,
  p_team_b_games INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_others INT;
  v_team TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_match.creator_id <> auth.uid() THEN RAISE EXCEPTION 'not_creator'; END IF;

  SELECT COUNT(*)::INT INTO v_others
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id <> auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL;

  IF v_others > 0 THEN RAISE EXCEPTION 'has_other_participants'; END IF;
  IF v_match.status NOT IN ('in_progress', 'finished_no_result') THEN
    RAISE EXCEPTION 'invalid_match_status';
  END IF;

  -- Block direct close if the rival team has pending/accepted invitations.
  IF EXISTS (
    SELECT 1 FROM public.match_invitations mi
    WHERE mi.match_id = p_match_id
      AND mi.status IN ('pending', 'accepted')
      AND mi.invitee_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'has_pending_rival_invites';
  END IF;

  PERFORM public.validate_match_scores(
    p_team_a_games, p_team_b_games, v_match.duration_target_games
  );

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

  v_team := COALESCE(NULLIF(TRIM(v_team), ''), 'A');

  INSERT INTO public.match_results (
    match_id, team_a_games, team_b_games, submitted_by_team, submitted_by_user_id, status
  ) VALUES (
    p_match_id, p_team_a_games, p_team_b_games, v_team, auth.uid(), 'confirmed'
  );

  UPDATE public.matches SET status = 'finished', updated_at = NOW() WHERE id = p_match_id;

  INSERT INTO public.match_state_transitions (
    match_id, from_status, to_status, triggered_by, user_id, reason
  ) VALUES (
    p_match_id, v_match.status, 'finished', 'user', auth.uid(), 'direct result by creator'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_match_result_direct(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_match_result_direct(UUID, INT, INT) TO authenticated;

-- ── delete_user_account_data: clean friendships + match_invitations ───────────

CREATE OR REPLACE FUNCTION public.delete_user_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sentinel_id UUID := public.deleted_user_id();
  v_deleted_label TEXT := 'Usuario eliminado';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  IF p_user_id = v_sentinel_id THEN
    RAISE EXCEPTION 'Cannot delete sentinel profile';
  END IF;

  -- Friendships + match invitations carry personal data; delete them.
  DELETE FROM public.friendships
    WHERE requester_id = p_user_id OR addressee_id = p_user_id;

  DELETE FROM public.match_invitations
    WHERE inviter_id = p_user_id OR invitee_id = p_user_id;

  DELETE FROM public.result_confirmations WHERE user_id = p_user_id;

  UPDATE public.match_results
  SET submitted_by_user_id = v_sentinel_id
  WHERE submitted_by_user_id = p_user_id;

  UPDATE public.matches
  SET creator_id = v_sentinel_id
  WHERE creator_id = p_user_id;

  UPDATE public.audit_logs
  SET admin_id = v_sentinel_id
  WHERE admin_id = p_user_id;

  DELETE FROM public.reports
  WHERE reporter_id = p_user_id
     OR (target_type = 'user' AND target_id = p_user_id);

  UPDATE public.reports SET resolved_by = NULL WHERE resolved_by = p_user_id;

  UPDATE public.match_state_transitions SET user_id = NULL WHERE user_id = p_user_id;

  DELETE FROM public.notification_queue WHERE user_id = p_user_id;

  -- ── Leagues ───────────────────────────────────────────────────────────────
  UPDATE public.leagues
  SET creator_id = v_sentinel_id
  WHERE creator_id = p_user_id;

  UPDATE public.league_challenges
  SET created_by_user_id = v_sentinel_id
  WHERE created_by_user_id = p_user_id;

  UPDATE public.league_pairs
  SET
    player_a_user_id = NULL,
    player_a_text = v_deleted_label
  WHERE player_a_user_id = p_user_id;

  UPDATE public.league_pairs
  SET
    player_b_user_id = NULL,
    player_b_text = v_deleted_label
  WHERE player_b_user_id = p_user_id;

  UPDATE public.league_pairs
  SET created_by_user_id = v_sentinel_id
  WHERE created_by_user_id = p_user_id;

  UPDATE public.league_pairs lp
  SET name = public.league_pair_display_name(lp)
  WHERE NOT lp.name_is_custom
    AND (lp.player_a_text = v_deleted_label OR lp.player_b_text = v_deleted_label);

  DELETE FROM public.league_password_grants WHERE user_id = p_user_id;

  -- ── Tournaments ───────────────────────────────────────────────────────────
  UPDATE public.tournaments
  SET creator_id = v_sentinel_id
  WHERE creator_id = p_user_id;

  UPDATE public.tournament_pairs
  SET
    player_a_user_id = NULL,
    player_a_text = v_deleted_label
  WHERE player_a_user_id = p_user_id;

  UPDATE public.tournament_pairs
  SET
    player_b_user_id = NULL,
    player_b_text = v_deleted_label
  WHERE player_b_user_id = p_user_id;

  UPDATE public.tournament_pairs
  SET created_by_user_id = v_sentinel_id
  WHERE created_by_user_id = p_user_id;

  DELETE FROM public.tournament_password_grants WHERE user_id = p_user_id;

  -- Drop duplicate roster rows when sentinel is already on the same match
  DELETE FROM public.match_participants AS mp
  WHERE mp.user_id = p_user_id
    AND EXISTS (
      SELECT 1
      FROM public.match_participants AS existing
      WHERE existing.match_id = mp.match_id
        AND existing.user_id = v_sentinel_id
        AND existing.id <> mp.id
    );

  UPDATE public.match_participants
  SET user_id = v_sentinel_id
  WHERE user_id = p_user_id;

  INSERT INTO public.match_participants (match_id, user_id, team, state)
  SELECT m.id, v_sentinel_id, 'A', 'confirmed'
  FROM public.matches AS m
  WHERE m.creator_id = v_sentinel_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.match_participants AS mp
      WHERE mp.match_id = m.id
        AND mp.user_id = v_sentinel_id
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
    )
    AND (
      SELECT COUNT(*)
      FROM public.match_participants AS mp
      WHERE mp.match_id = m.id
        AND mp.team = 'A'
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
    ) < 2;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(UUID) TO service_role;

-- ── Realtime ───────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_invitations;
