-- Migration 061: backfill relay-derived Apple display names

UPDATE public.profiles p
SET display_name = 'Usuario'
FROM auth.users u
WHERE p.id = u.id
  AND u.email ILIKE '%@privaterelay.appleid.com'
  AND p.display_name = SPLIT_PART(u.email, '@', 1);
