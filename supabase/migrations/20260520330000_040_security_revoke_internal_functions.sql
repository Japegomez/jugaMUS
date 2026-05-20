-- 040: Revoke public/authenticated EXECUTE on internal SECURITY DEFINER functions.

REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM authenticated;

REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_match_state_transitions() FROM authenticated;

REVOKE ALL ON FUNCTION public.advance_tournament_round(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_tournament_round(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.propagate_tournament_winners(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_tournament_winners(UUID) FROM authenticated;

REVOKE ALL ON FUNCTION public.finalize_tournament_if_final_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_tournament_if_final_match(UUID) FROM authenticated;
