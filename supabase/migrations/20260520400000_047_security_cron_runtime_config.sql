-- 047: Runtime config table for cron (ALTER DATABASE not available on Supabase hosted).

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.runtime_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON private.runtime_config FROM PUBLIC;

INSERT INTO private.runtime_config (key, value) VALUES
  ('edge_function_url', 'https://gnseokumiqtdtdzyrldk.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT cron.unschedule('process-notification-queue');

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$SELECT extensions.http_post(
    url := (SELECT value FROM private.runtime_config WHERE key = 'edge_function_url') || '/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT value FROM private.runtime_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  )$$
);
