-- Migration 091: Re-expose player stats RPCs to PostgREST

REVOKE ALL ON FUNCTION public.get_player_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_stats(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_leaderboard(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_match_player_insights(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_player_insights(UUID, UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
