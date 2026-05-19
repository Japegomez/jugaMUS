-- Migration 019: audit_logs + admin RLS on reports, profiles, matches

-- ── Helper: is current user admin? ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated;

-- ── audit_logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('report', 'user', 'match', 'result')),
  target_id   UUID NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin
  ON public.audit_logs (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY audit_logs_insert_admin ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_admin()
    AND admin_id = auth.uid()
  );

-- ── Admin policies: reports ──────────────────────────────────────────────────

CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ── Admin policies: profiles (suspend / unblock) ─────────────────────────────

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ── Admin policies: matches (delete) ─────────────────────────────────────────

CREATE POLICY matches_delete_admin ON public.matches
  FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- ── Admin policies: match_results (delete disputed / invalid) ────────────────

CREATE POLICY match_results_delete_admin ON public.match_results
  FOR DELETE TO authenticated
  USING (public.auth_is_admin());
