-- Migration 021: allow admins to read profiles, matches, and results for moderation UI

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY matches_select_admin ON public.matches
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

CREATE POLICY match_results_select_admin ON public.match_results
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());
