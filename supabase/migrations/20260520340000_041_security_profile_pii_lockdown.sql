-- 041: Lock down PII columns (phone_e164, push_token) and expose safe profile reads via RPCs.

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  display_name,
  photo_url,
  city
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- Column-level: hide phone and push token from direct table SELECT.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id,
  display_name,
  city,
  photo_url,
  notify_email,
  notify_push,
  notify_on_join,
  notify_on_match_change,
  notify_on_result,
  notify_on_reminder,
  role,
  status,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

GRANT UPDATE (
  display_name,
  phone_e164,
  city,
  photo_url,
  notify_email,
  notify_push,
  notify_on_join,
  notify_on_match_change,
  notify_on_result,
  notify_on_reminder,
  push_token
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  photo_url TEXT,
  city TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.display_name, p.photo_url, p.city
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND (
      p.id = auth.uid()
      OR public.profile_shares_confirmed_match_with_auth(p.id)
      OR EXISTS (
        SELECT 1
        FROM public.tournament_pairs tp
        WHERE tp.tournament_id IS NOT NULL
          AND public.auth_can_read_tournament(tp.tournament_id)
          AND (tp.player_a_user_id = p.id OR tp.player_b_user_id = p.id)
      )
      OR public.auth_is_admin()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
