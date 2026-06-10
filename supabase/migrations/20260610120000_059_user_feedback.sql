-- Migration 059: user feedback (issues & feature suggestions)

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('issue', 'feature', 'other')),
  message    TEXT NOT NULL CHECK (char_length(trim(message)) >= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created
  ON public.user_feedback (created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_feedback_insert ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_feedback_select_own ON public.user_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_feedback_select_admin ON public.user_feedback
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());
