-- Migration 010: Phase 2 tables — results, confirmations, reports,
-- notification queue, match state transitions, push token on profiles.
-- Indexes and RLS included.

-- ── push_token on profiles ──────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ── match_results ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_a_games          INT  NOT NULL CHECK (team_a_games >= 0),
  team_b_games          INT  NOT NULL CHECK (team_b_games >= 0),
  submitted_by_team     TEXT NOT NULL CHECK (submitted_by_team IN ('A', 'B')),
  submitted_by_user_id  UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                TEXT NOT NULL DEFAULT 'pending_validation'
                          CHECK (status IN ('pending_validation', 'confirmed', 'disputed', 'void')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── result_confirmations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.result_confirmations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_result_id  UUID NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.profiles(id),
  team             TEXT NOT NULL CHECK (team IN ('A', 'B')),
  decision         TEXT NOT NULL CHECK (decision IN ('approve', 'dispute')),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_result_id, user_id)
);

-- ── reports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('user', 'match', 'result')),
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  notes        TEXT,
  reporter_id  UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  action_taken TEXT,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES public.profiles(id)
);

-- ── notification_queue ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  payload_json   JSONB,
  scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts       INT  NOT NULL DEFAULT 0,
  max_attempts   INT  NOT NULL DEFAULT 3,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ
);

-- ── match_state_transitions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_state_transitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  from_status  TEXT NOT NULL,
  to_status    TEXT NOT NULL,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'system')),
  user_id      UUID REFERENCES public.profiles(id),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Notification queue: only pending rows scheduled in the past
CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON public.notification_queue (scheduled_for)
  WHERE status = 'pending';

-- Reports: admin views open reports sorted by recency
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON public.reports (status, created_at DESC);

-- Results per match
CREATE INDEX IF NOT EXISTS idx_results_match
  ON public.match_results (match_id, status);

-- State transitions audit trail
CREATE INDEX IF NOT EXISTS idx_state_transitions_match
  ON public.match_state_transitions (match_id, created_at DESC);

-- ── updated_at trigger for match_results ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_match_results_updated_at'
  ) THEN
    CREATE TRIGGER trg_match_results_updated_at
      BEFORE UPDATE ON public.match_results
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.match_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_confirmations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_state_transitions ENABLE ROW LEVEL SECURITY;

-- match_results: participants of the match can read; submitter can insert
CREATE POLICY match_results_select ON public.match_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_results.match_id
        AND mp.user_id  = auth.uid()
        AND mp.state    = 'confirmed'
    )
  );

CREATE POLICY match_results_insert ON public.match_results
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_results.match_id
        AND mp.user_id  = auth.uid()
        AND mp.state    = 'confirmed'
    )
  );

-- result_confirmations: participants can read and insert for their team
CREATE POLICY result_confirmations_select ON public.result_confirmations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_results mr
      JOIN public.match_participants mp ON mp.match_id = mr.match_id
      WHERE mr.id        = result_confirmations.match_result_id
        AND mp.user_id   = auth.uid()
        AND mp.state     = 'confirmed'
    )
  );

CREATE POLICY result_confirmations_insert ON public.result_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_results mr
      JOIN public.match_participants mp ON mp.match_id = mr.match_id
      WHERE mr.id      = result_confirmations.match_result_id
        AND mp.user_id = auth.uid()
        AND mp.state   = 'confirmed'
    )
  );

-- reports: any authenticated user can insert; only the reporter can read their own reports
CREATE POLICY reports_insert ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_select_own ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- notification_queue: users see only their own notifications (queue is written by service role)
CREATE POLICY notification_queue_select_own ON public.notification_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- match_state_transitions: participants of the match can read
CREATE POLICY state_transitions_select ON public.match_state_transitions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_state_transitions.match_id
        AND mp.user_id  = auth.uid()
        AND mp.state    = 'confirmed'
    )
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id         = match_state_transitions.match_id
        AND m.creator_id = auth.uid()
    )
  );
