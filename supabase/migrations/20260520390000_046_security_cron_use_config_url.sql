-- 046: Cron invokes process-notifications via configurable URL + X-Cron-Secret header.
--
-- After applying, set database config (Supabase SQL editor):
--   ALTER DATABASE postgres SET app.edge_function_url = 'https://<ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.cron_secret = '<same value as Edge Function CRON_SECRET>';
-- Also set CRON_SECRET in Supabase Dashboard → Edge Functions → Secrets.

SELECT cron.unschedule('process-notification-queue');

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$SELECT extensions.http_post(
    url := current_setting('app.edge_function_url', true) || '/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  )$$
);
