-- 098: Badge showcase on profiles
-- Users can pin up to 3 earned badges on their profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS badge_showcase TEXT[] NOT NULL DEFAULT '{}';

-- Normalize existing rows: keep at most 3, drop duplicates/empties
UPDATE public.profiles
SET badge_showcase = sub.keys
FROM (
  SELECT
    id,
    COALESCE(
      (
        SELECT array_agg(k ORDER BY ord)
        FROM (
          SELECT DISTINCT k, ord
          FROM (
            SELECT value AS k, ordinality AS ord
            FROM unnest(badge_showcase) WITH ORDINALITY AS u(value, ordinality)
            WHERE value IS NOT NULL AND length(value) > 0
          ) t
          ORDER BY ord
          LIMIT 3
        ) s
      ),
      '{}'::text[]
    ) AS keys
  FROM public.profiles
) sub
WHERE sub.id = public.profiles.id;

-- Expose showcase on viewable profiles (recreate return type)
DROP FUNCTION IF EXISTS public.get_viewable_user_profile(UUID);

CREATE OR REPLACE FUNCTION public.get_viewable_user_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  city TEXT,
  phone_e164 TEXT,
  photo_url TEXT,
  badge_showcase TEXT[]
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
    p.photo_url,
    p.badge_showcase
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND public.profile_is_viewable_by_auth(p.id);
$$;

REVOKE ALL ON FUNCTION public.get_viewable_user_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewable_user_profile(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
