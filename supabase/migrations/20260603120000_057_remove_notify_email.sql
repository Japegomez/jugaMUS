-- 057: Remove email notification preference (push-only notifications).

ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_email;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id,
  display_name,
  city,
  photo_url,
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

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name,
  phone_e164,
  city,
  photo_url,
  notify_push,
  notify_on_join,
  notify_on_match_change,
  notify_on_result,
  notify_on_reminder,
  push_token
) ON public.profiles TO authenticated;
