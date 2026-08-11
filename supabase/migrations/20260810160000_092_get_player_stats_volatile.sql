-- Fix: get_player_stats calls ensure_player_stats_row (INSERT) so it cannot be STABLE.

ALTER FUNCTION public.get_player_stats(uuid) VOLATILE;

NOTIFY pgrst, 'reload schema';
