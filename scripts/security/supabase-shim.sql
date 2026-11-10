-- Minimal Supabase-compatible shim for disposable Postgres (security harness).
-- Applied before project migrations. Does NOT replace real Supabase Auth/Storage.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- ── Roles (Supabase API roles) ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END;
$$;

GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

-- ── Schemas ───────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA net TO anon, authenticated, service_role;

-- Mimic Supabase default privileges: new functions executable by API roles
-- until an explicit REVOKE (the class of bug Strix found).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ── auth.uid() from JWT claim ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$$;

-- Minimal auth.users (columns used by migrations 001/007/024/061/125)
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  instance_id UUID,
  aud TEXT,
  role TEXT,
  email TEXT,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  confirmation_token TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token TEXT,
  recovery_sent_at TIMESTAMPTZ,
  email_change_token_new TEXT,
  email_change TEXT,
  email_change_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  phone TEXT,
  phone_confirmed_at TIMESTAMPTZ,
  phone_change TEXT,
  phone_change_token TEXT,
  phone_change_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current TEXT,
  email_change_confirm_status SMALLINT,
  banned_until TIMESTAMPTZ,
  reauthentication_token TEXT,
  reauthentication_sent_at TIMESTAMPTZ,
  is_sso_user BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE
);

GRANT SELECT ON TABLE auth.users TO postgres, service_role;
-- SECURITY DEFINER RPCs (admin_set_user_status) run as owner and UPDATE this table.

-- ── storage stubs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE storage.buckets TO postgres, service_role;
GRANT ALL ON TABLE storage.objects TO postgres, service_role;
GRANT SELECT ON TABLE storage.buckets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated;
GRANT SELECT ON TABLE storage.objects TO anon;

-- ── cron stubs (pg_cron not in alpine image) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cron.job (
  jobid BIGSERIAL PRIMARY KEY,
  schedule TEXT,
  command TEXT,
  nodename TEXT DEFAULT 'localhost',
  nodeport INT DEFAULT 5432,
  database TEXT DEFAULT 'postgres',
  username TEXT DEFAULT 'postgres',
  active BOOLEAN DEFAULT TRUE,
  jobname TEXT
);

CREATE OR REPLACE FUNCTION cron.schedule(
  job_name TEXT,
  schedule TEXT,
  command TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  DELETE FROM cron.job WHERE jobname = job_name;
  INSERT INTO cron.job (schedule, command, jobname)
  VALUES (schedule, command, job_name)
  RETURNING jobid INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM cron.job WHERE jobname = job_name;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM cron.job WHERE jobid = job_id;
  RETURN FOUND;
END;
$$;

-- ── net / extensions HTTP stubs (pg_net not in alpine image) ──────────────────
CREATE TABLE IF NOT EXISTS net._http_response (
  id BIGSERIAL PRIMARY KEY,
  status_code INT,
  content_type TEXT,
  headers JSONB,
  content TEXT,
  timed_out BOOLEAN,
  error_msg TEXT,
  created TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION net.http_post(
  url TEXT,
  body JSONB DEFAULT '{}'::jsonb,
  params JSONB DEFAULT '{}'::jsonb,
  headers JSONB DEFAULT '{}'::jsonb,
  timeout_milliseconds INT DEFAULT 5000
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO net._http_response (status_code, content_type, content, created)
  VALUES (200, 'application/json', '{"ok":true}', NOW())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Older migrations call extensions.http_post(...)
CREATE OR REPLACE FUNCTION extensions.http_post(
  url TEXT,
  body JSONB DEFAULT '{}'::jsonb,
  params JSONB DEFAULT '{}'::jsonb,
  headers JSONB DEFAULT '{}'::jsonb,
  timeout_milliseconds INT DEFAULT 5000
)
RETURNS BIGINT
LANGUAGE sql
AS $$
  SELECT net.http_post(url, body, params, headers, timeout_milliseconds);
$$;

-- Ensure crypt/gen_salt resolve when search_path includes extensions
CREATE OR REPLACE FUNCTION extensions.crypt(TEXT, TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.crypt($1, $2);
$$;

CREATE OR REPLACE FUNCTION extensions.gen_salt(TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT public.gen_salt($1);
$$;

CREATE OR REPLACE FUNCTION extensions.gen_salt(TEXT, INT)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT public.gen_salt($1, $2);
$$;

-- Realtime publication (Supabase creates this; migrations ALTER it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

-- Session defaults (also applied by harness after connect)
SET search_path TO public, extensions, auth, storage, net, cron;
