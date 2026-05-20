-- Migration 022: Granular notification preferences on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_on_join BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_match_change BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_result BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_reminder BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.profiles.notify_on_join IS 'Notify when someone joins the user''s match';
COMMENT ON COLUMN public.profiles.notify_on_match_change IS 'Notify when a joined match is edited or cancelled';
COMMENT ON COLUMN public.profiles.notify_on_result IS 'Notify when a match result is submitted or confirmed';
COMMENT ON COLUMN public.profiles.notify_on_reminder IS 'Notify for 24h/2h match reminders';
