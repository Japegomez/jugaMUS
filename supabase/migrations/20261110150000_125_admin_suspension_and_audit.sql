-- 125: Real suspension (banned_until) + restore audit_logs INSERT + rotate sentinel.
-- Closes vuln-0003 / 0001.

-- ── admin_set_user_status ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_user_id UUID,
  p_status  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_allowed  TEXT[] := ARRAY['active', 'suspended'];
BEGIN
  PERFORM public.admin_assert_is_admin();

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF p_status IS NULL OR p_status <> ALL (v_allowed) THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'cannot_self_suspend';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.profiles
  SET status = p_status
  WHERE id = p_user_id;

  IF p_status = 'suspended' THEN
    UPDATE auth.users
    SET banned_until = 'infinity'
    WHERE id = p_user_id;
  ELSE
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_status = 'suspended' THEN 'block_user' ELSE 'unblock_user' END,
    'user',
    p_user_id,
    jsonb_build_object('status', p_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_status(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, TEXT) TO authenticated;

-- ── Restore INSERT on audit_logs (revoked by 118; policy still requires admin) ─
GRANT INSERT ON TABLE public.audit_logs TO authenticated;

-- ── Rotate historical sentinel credential (deleted-user@internal…) ───────────
UPDATE auth.users
SET
  encrypted_password = '',
  banned_until = 'infinity'
WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;

NOTIFY pgrst, 'reload schema';
