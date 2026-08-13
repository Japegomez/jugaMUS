-- 118: Security follow-up — RLS gaps and over-exposed SECURITY DEFINER RPCs
-- Findings from production audit (ago. 2026):
--   1. player_stats_recompute_queue: RLS off + full grants to anon/authenticated
--   2. match_invitations SELECT policy: unqualified `match_id` resolved to
--      mp.match_id (always true) → any confirmed participant could read all invites
--   3. Cron/lifecycle RPCs still EXECUTE for anon (CREATE OR REPLACE re-grants PUBLIC)
--   4. player_stats SELECT USING (true) bypasses get_player_stats visibility gate
--   5. Internal `_` helpers still executable by clients

-- ── 1. Lock down player_stats_recompute_queue ─────────────────────────────────
ALTER TABLE public.player_stats_recompute_queue ENABLE ROW LEVEL SECURITY;
-- No client policies: only service_role / SECURITY DEFINER internals may touch it.
REVOKE ALL ON TABLE public.player_stats_recompute_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.player_stats_recompute_queue FROM anon;
REVOKE ALL ON TABLE public.player_stats_recompute_queue FROM authenticated;

-- ── 2. Fix match_invitations SELECT (qualify outer match_id) ──────────────────
DROP POLICY IF EXISTS match_invitations_select_party ON public.match_invitations;

CREATE POLICY match_invitations_select_party ON public.match_invitations
  FOR SELECT TO authenticated
  USING (
    inviter_id = auth.uid()
    OR invitee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_invitations.match_id
        AND m.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_invitations.match_id
        AND mp.user_id = auth.uid()
        AND mp.state = 'confirmed'
        AND mp.left_at IS NULL
    )
    OR public.auth_is_admin()
  );

-- ── 3. Revoke cron / lifecycle / enqueue from client roles ────────────────────
-- pg_cron runs as a privileged DB role and keeps EXECUTE regardless.
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM anon;
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM authenticated;

REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM anon;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM authenticated;

REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM authenticated;

-- Keep league lifecycle locked (idempotent with 106).
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM anon;
REVOKE ALL ON FUNCTION public.process_league_lifecycle() FROM authenticated;

-- ── 4. Gate player_stats table SELECT to profile visibility ───────────────────
-- App reads stats via get_player_stats / get_leaderboard / get_player_ranking RPCs.
DROP POLICY IF EXISTS player_stats_select_authenticated ON public.player_stats;

CREATE POLICY player_stats_select_authenticated ON public.player_stats
  FOR SELECT TO authenticated
  USING (
    public.profile_is_viewable_by_auth(user_id)
    OR public.auth_is_admin()
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.player_stats FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.player_stats FROM authenticated;
GRANT SELECT ON TABLE public.player_stats TO authenticated;

-- ── 5. Revoke internal underscore helpers from clients ────────────────────────
REVOKE ALL ON FUNCTION public._finished_league_ranks_for_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._finished_league_ranks_for_user(UUID) FROM anon;
REVOKE ALL ON FUNCTION public._finished_league_ranks_for_user(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public._player_broke_nine_win_streak(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._player_broke_nine_win_streak(UUID) FROM anon;
REVOKE ALL ON FUNCTION public._player_broke_nine_win_streak(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public._player_confirmed_match_rows(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._player_confirmed_match_rows(UUID) FROM anon;
REVOKE ALL ON FUNCTION public._player_confirmed_match_rows(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public._player_won_match(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._player_won_match(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public._player_won_match(TEXT, INTEGER, INTEGER) FROM authenticated;

-- ── 6. Defense-in-depth: sensitive tables — no broad client DML grants ────────
REVOKE ALL ON TABLE public.notification_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_queue FROM anon;
REVOKE ALL ON TABLE public.notification_queue FROM authenticated;
GRANT SELECT ON TABLE public.notification_queue TO authenticated;

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
