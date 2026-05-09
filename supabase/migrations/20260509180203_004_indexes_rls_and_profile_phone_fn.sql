CREATE INDEX idx_matches_search ON public.matches (city, start_at, status);
CREATE INDEX idx_matches_user_history ON public.matches (creator_id, created_at DESC);
CREATE INDEX idx_participants_match_team ON public.match_participants (match_id, team, state);
CREATE INDEX idx_participants_user ON public.match_participants (user_id, joined_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY profiles_select_co_participant ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.match_participants mp_self
      JOIN public.match_participants mp_other ON mp_self.match_id = mp_other.match_id
      WHERE mp_self.user_id = auth.uid()
        AND mp_other.user_id = profiles.id
        AND mp_self.state = 'confirmed'
        AND mp_other.state = 'confirmed'
    )
  );

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = matches.id AND mp.user_id = auth.uid() AND mp.state = 'confirmed'
    )
    OR visibility = 'link'
  );

CREATE POLICY matches_insert_creator ON public.matches
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

CREATE POLICY matches_update_creator ON public.matches
  FOR UPDATE TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY matches_delete_creator ON public.matches
  FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE POLICY participants_select ON public.match_participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND m.creator_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = match_participants.match_id AND mp.user_id = auth.uid() AND mp.state = 'confirmed'
    )
  );

CREATE POLICY participants_insert_self ON public.match_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY participants_update_self ON public.match_participants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_profile_with_phone(p_match_id uuid, p_profile_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM public.match_participants me
      WHERE me.match_id = p_match_id AND me.user_id = auth.uid() AND me.state = 'confirmed'
    )
    AND EXISTS (
      SELECT 1 FROM public.match_participants them
      WHERE them.match_id = p_match_id AND them.user_id = p_profile_id AND them.state = 'confirmed'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_with_phone(uuid, uuid) TO authenticated;
