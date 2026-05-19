# Sentry observability (Phase 3)

Client performance is configured in [`src/lib/sentry.ts`](../src/lib/sentry.ts) (`tracesSampleRate`, `profilesSampleRate`, auto performance tracing).

## Cron Monitor — `process-notifications`

1. Sentry → **Crons** → **Create Monitor**
2. Name: `process-notifications-health`
3. Schedule: `*/5 * * * *` (every 5 minutes)
4. Link to GitHub Action: [`.github/workflows/sentry-health.yml`](../.github/workflows/sentry-health.yml) (upload check-in from workflow or use Sentry CLI `sentry monitors run`)

Alternatively, use the same schedule as `pg_cron` that invokes the function and report success/failure via Sentry Cron check-ins in CI.

**Repo secrets** (for the workflow): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Alert rules — 5xx and latency

In Sentry (EU: `de.sentry.io`):

1. **Alerts** → **Create Alert** → **Issues**
   - When: `event.level` is `error` OR `http.status_code` ≥ 500
   - Filter: project `musapp` (mobile) and any backend/edge projects if added
2. **Alerts** → **Create Alert** → **Performance**
   - Metric: `p95(transaction.duration)`
   - Threshold: e.g. > 3000 ms for 5 minutes
   - Action: email / Slack

## Performance dashboard

1. **Dashboards** → **Create Dashboard** → name: `Mus App — Performance`
2. Add widgets:
   - Transaction duration (p50, p95)
   - App start cold/warm (from React Native SDK)
   - Error rate by release
   - Crash-free sessions

## Edge Function errors

Deploy with Sentry DSN in Supabase Edge secrets if you add `@sentry/deno` later; until then, rely on Supabase function logs + the health workflow above.
