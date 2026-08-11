-- 105: Account deletion must anonymize league/tournament FKs.
-- Without this, auth.admin.deleteUser fails with:
--   leagues_creator_id_fkey / tournament creator & pair FKs still reference profiles.

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

  -- Password grants cascade on profile delete; explicit cleanup is fine.
  DELETE FROM public.league_password_grants WHERE user_id = p_user_id;

  -- ── Tournaments (same gap as leagues) ─────────────────────────────────────
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

  -- Reassign remaining participations so the UI still shows "Usuario eliminado"
  UPDATE public.match_participants
  SET user_id = v_sentinel_id
  WHERE user_id = p_user_id;

  -- Repair creator-only matches already processed with an empty roster
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
