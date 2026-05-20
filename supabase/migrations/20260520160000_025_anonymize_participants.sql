-- Migration 025: Keep anonymized users visible on rosters (reassign participants, don't delete).

CREATE OR REPLACE FUNCTION public.delete_user_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sentinel_id UUID := public.deleted_user_id();
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

-- Backfill matches already anonymized without a roster row
INSERT INTO public.match_participants (match_id, user_id, team, state)
SELECT m.id, public.deleted_user_id(), 'A', 'confirmed'
FROM public.matches AS m
WHERE m.creator_id = public.deleted_user_id()
  AND NOT EXISTS (
    SELECT 1
    FROM public.match_participants AS mp
    WHERE mp.match_id = m.id
      AND mp.user_id = public.deleted_user_id()
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
