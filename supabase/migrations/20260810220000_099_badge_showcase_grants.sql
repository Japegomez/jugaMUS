-- 099: Allow authenticated users to update/select badge_showcase on own profile

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, city, photo_url, badge_showcase, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, role, status, created_at, updated_at
) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, phone_e164, city, photo_url, badge_showcase, notify_push, notify_on_join,
  notify_on_match_change, notify_on_match_start, notify_on_match_edit, notify_on_match_cancel,
  notify_on_result, notify_on_reminder, notify_on_reminder_24h, notify_on_reminder_2h,
  notify_on_reminder_in_progress, push_token
) ON public.profiles TO authenticated;
