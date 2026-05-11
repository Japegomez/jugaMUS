-- Infinite RLS recursion on match_participants (Postgres ERROR):
-- participants_select referenced match_participants inside its own USING;
-- profiles_select_co_participant joined match_participants;
-- matches_select EXISTS over match_participants. Chained checks caused 500 on GET /profiles.

CREATE OR REPLACE FUNCTION public.auth_is_confirmed_in_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = auth.uid()
      AND mp.state = 'confirmed'
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_shares_confirmed_match_with_auth(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants mp_self
    INNER JOIN public.match_participants mp_other ON mp_self.match_id = mp_other.match_id
    WHERE mp_self.user_id = auth.uid()
      AND mp_other.user_id = p_profile_id
      AND mp_self.state = 'confirmed'
      AND mp_other.state = 'confirmed'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_confirmed_in_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_shares_confirmed_match_with_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_confirmed_in_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_shares_confirmed_match_with_auth(uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_select_co_participant ON public.profiles;
CREATE POLICY profiles_select_co_participant ON public.profiles
  FOR SELECT TO authenticated
  USING (public.profile_shares_confirmed_match_with_auth(id));

DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR public.auth_is_confirmed_in_match(id)
    OR visibility = 'link'
  );

DROP POLICY IF EXISTS participants_select ON public.match_participants;
CREATE POLICY participants_select ON public.match_participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id AND m.creator_id = auth.uid()
    )
    OR public.auth_is_confirmed_in_match(match_participants.match_id)
  );
