-- Migration 023: Ordered cleanup before auth user deletion (GDPR account erasure).
-- profiles.id cascades from auth.users, but many tables reference profiles without CASCADE.

CREATE OR REPLACE FUNCTION public.delete_user_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Confirmations and results submitted by the user
  DELETE FROM public.result_confirmations WHERE user_id = p_user_id;
  DELETE FROM public.match_results WHERE submitted_by_user_id = p_user_id;

  -- Reports involving the user
  DELETE FROM public.reports
  WHERE reporter_id = p_user_id
     OR (target_type = 'user' AND target_id = p_user_id);

  DELETE FROM public.reports
  WHERE target_type = 'match'
    AND target_id IN (SELECT id FROM public.matches WHERE creator_id = p_user_id);

  DELETE FROM public.reports
  WHERE target_type = 'result'
    AND target_id IN (
      SELECT mr.id
      FROM public.match_results mr
      INNER JOIN public.matches m ON m.id = mr.match_id
      WHERE m.creator_id = p_user_id
    );

  UPDATE public.reports SET resolved_by = NULL WHERE resolved_by = p_user_id;

  UPDATE public.match_state_transitions SET user_id = NULL WHERE user_id = p_user_id;

  DELETE FROM public.notification_queue WHERE user_id = p_user_id;

  DELETE FROM public.match_participants WHERE user_id = p_user_id;

  DELETE FROM public.audit_logs WHERE admin_id = p_user_id;

  -- Created matches cascade participants, results, transitions on those matches
  DELETE FROM public.matches WHERE creator_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(UUID) TO service_role;
