-- Users created in auth.users without a matching public.profiles row (e.g. trigger added later or failed).
-- Safe to re-run: skips rows that already exist.

INSERT INTO public.profiles (id, display_name, phone_e164)
SELECT u.id,
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(COALESCE(u.email, 'user@unknown'), '@', 1)
  ),
  COALESCE(u.raw_user_meta_data->>'phone_e164', '+34000000000')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
