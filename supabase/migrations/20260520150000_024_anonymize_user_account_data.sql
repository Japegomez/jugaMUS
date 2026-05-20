-- Migration 024: Anonymize user account data instead of deleting matches on erasure.
-- Replaces delete_user_account_data with sentinel reassignment for historical records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fixed sentinel profile for anonymized references (must never be deleted).
-- UUID v4: 00000000-0000-4000-8000-000000000001

CREATE OR REPLACE FUNCTION public.deleted_user_id()
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

DO $$
DECLARE
  v_sentinel_id UUID := public.deleted_user_id();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_sentinel_id) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    ) VALUES (
      v_sentinel_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'deleted-user@internal.mussasuerte.invalid',
      crypt('sentinel-no-login', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Usuario eliminado"}'::jsonb,
      NOW(),
      NOW(),
      FALSE,
      FALSE
    );
  END IF;

  INSERT INTO public.profiles (id, display_name, phone_e164, status, notify_email, notify_push)
  VALUES (v_sentinel_id, 'Usuario eliminado', '+34000000000', 'suspended', FALSE, FALSE)
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status = 'suspended',
        notify_email = FALSE,
        notify_push = FALSE,
        photo_url = NULL,
        push_token = NULL,
        city = NULL;
END;
$$;

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

  -- Confirmations tied to the user (keep match results, drop personal approval rows)
  DELETE FROM public.result_confirmations WHERE user_id = p_user_id;

  -- Reassign authorship; keep match history
  UPDATE public.match_results
  SET submitted_by_user_id = v_sentinel_id
  WHERE submitted_by_user_id = p_user_id;

  UPDATE public.matches
  SET creator_id = v_sentinel_id
  WHERE creator_id = p_user_id;

  UPDATE public.audit_logs
  SET admin_id = v_sentinel_id
  WHERE admin_id = p_user_id;

  -- Remove personal reports and queue entries
  DELETE FROM public.reports
  WHERE reporter_id = p_user_id
     OR (target_type = 'user' AND target_id = p_user_id);

  UPDATE public.reports SET resolved_by = NULL WHERE resolved_by = p_user_id;

  UPDATE public.match_state_transitions SET user_id = NULL WHERE user_id = p_user_id;

  DELETE FROM public.notification_queue WHERE user_id = p_user_id;

  -- Leave matches intact; remove roster membership only
  DELETE FROM public.match_participants WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deleted_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(UUID) TO service_role;
