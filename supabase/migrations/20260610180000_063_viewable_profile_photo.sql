-- 063: Expose avatar URL on viewable user profiles (same visibility gate as display_name).

DROP FUNCTION IF EXISTS public.get_viewable_user_profile(UUID);

CREATE OR REPLACE FUNCTION public.get_viewable_user_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  city TEXT,
  phone_e164 TEXT,
  photo_url TEXT
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
    CASE
      WHEN p.id = auth.uid()
        OR public.profile_shares_confirmed_match_with_auth(p.id)
        OR public.auth_is_admin()
      THEN p.phone_e164
      ELSE NULL
    END AS phone_e164,
    p.photo_url
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND public.profile_is_viewable_by_auth(p.id);
$$;

REVOKE ALL ON FUNCTION public.get_viewable_user_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewable_user_profile(UUID) TO authenticated;
