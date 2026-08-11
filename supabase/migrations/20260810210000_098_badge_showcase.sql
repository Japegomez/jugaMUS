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
          SELECT k, ord
          FROM (
            SELECT
              pg_catalog.btrim(u.value::text) AS k,
              u.ordinality AS ord,
              ROW_NUMBER() OVER (
                PARTITION BY pg_catalog.btrim(u.value::text)
                ORDER BY u.ordinality
              ) AS rn
            FROM pg_catalog.unnest(badge_showcase) WITH ORDINALITY AS u(value, ordinality)
            WHERE u.value IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(u.value::text)) > 0
          ) t
          WHERE t.rn = 1
        ) s
        ORDER BY ord
        LIMIT 3
      ),
      '{}'::text[]
    ) AS keys
  FROM public.profiles
) sub
WHERE sub.id = public.profiles.id;

-- Validate badge_showcase on every update/insert.
-- Reject:
-- - empty/blank keys inside the array
-- - duplicates
-- - more than 3 keys
-- - keys not present in player_stats.badges for this user
CREATE OR REPLACE FUNCTION public.validate_badge_showcase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.badge_showcase IS NULL THEN
    RAISE EXCEPTION 'badge_showcase_null';
  END IF;

  -- Max 3 slots.
  IF pg_catalog.cardinality(NEW.badge_showcase) > 3 THEN
    RAISE EXCEPTION 'badge_showcase_too_many';
  END IF;

  -- No empty/blank values.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(NEW.badge_showcase) k
    WHERE k IS NULL OR pg_catalog.length(pg_catalog.btrim(k)) = 0
  ) THEN
    RAISE EXCEPTION 'badge_showcase_empty_value';
  END IF;

  -- No duplicates.
  IF (
    SELECT pg_catalog.count(DISTINCT k) FROM pg_catalog.unnest(NEW.badge_showcase) k
  ) <> pg_catalog.cardinality(NEW.badge_showcase) THEN
    RAISE EXCEPTION 'badge_showcase_duplicates';
  END IF;

  -- Keys must exist in earned badges.
  IF pg_catalog.cardinality(NEW.badge_showcase) > 0 AND EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(NEW.badge_showcase) k
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.player_stats ps,
           pg_catalog.jsonb_array_elements(ps.badges) b
      WHERE ps.user_id = NEW.id
        AND b->>'key' = k
    )
  ) THEN
    RAISE EXCEPTION 'badge_showcase_invalid_key';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_badge_showcase_trg ON public.profiles;
CREATE TRIGGER validate_badge_showcase_trg
BEFORE INSERT OR UPDATE OF badge_showcase
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_badge_showcase();

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
SET search_path = ''
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
