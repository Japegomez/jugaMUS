-- 104: Async player_stats aggregates recompute queue
-- Problem: fn_on_match_result_confirmed was synchronously rebuilding
-- recompute_player_stats_aggregates() for each participant (full history),
-- which can block match confirmation.
--
-- Fix: keep the trigger synchronous for ELO only, and enqueue participant
-- user_ids to recompute aggregates asynchronously via pg_cron.

CREATE TABLE IF NOT EXISTS public.player_stats_recompute_queue (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.player_stats_recompute_queue FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enqueue_player_stats_recompute(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.player_stats_recompute_queue(user_id, queued_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET queued_at = EXCLUDED.queued_at;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_player_stats_recompute(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.process_player_stats_recompute_queue(p_limit INT DEFAULT 50)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RETURN;
  END IF;

  FOR v_user_id IN
    SELECT user_id
    FROM public.player_stats_recompute_queue
    ORDER BY queued_at ASC
    LIMIT p_limit
  LOOP
    PERFORM public.recompute_player_stats_aggregates(v_user_id);
    DELETE FROM public.player_stats_recompute_queue
    WHERE user_id = v_user_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_player_stats_recompute_queue(INT) FROM PUBLIC;

-- Replace synchronous per-match aggregate rebuild with enqueue.
CREATE OR REPLACE FUNCTION public.recompute_player_stats_for_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.match_results mr ON mr.match_id = m.id AND mr.status = 'confirmed'
    WHERE m.id = p_match_id
      AND m.status = 'finished'
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
  ) THEN
    RETURN;
  END IF;

  -- ELO first (fast, limited to the confirmed match participants).
  PERFORM public.apply_match_elo(p_match_id);

  -- Enqueue full-aggregate rebuild asynchronously.
  FOR v_uid IN
    SELECT DISTINCT mp.user_id
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.state = 'confirmed'
      AND mp.user_id IS NOT NULL
  LOOP
    PERFORM public.enqueue_player_stats_recompute(v_uid);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_player_stats_for_match(UUID) FROM PUBLIC;

-- Cron job: process a small batch every minute.
DO $$
BEGIN
  PERFORM cron.unschedule('process-player-stats-recompute-queue');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- job may not exist yet on first apply
END;
$$;
SELECT cron.schedule(
  'process-player-stats-recompute-queue',
  '* * * * *',
  'SELECT public.process_player_stats_recompute_queue(50)'
);

NOTIFY pgrst, 'reload schema';

