-- 068: Password grants for private matches (view access separate from joining).

CREATE TABLE IF NOT EXISTS public.match_password_grants (
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

ALTER TABLE public.match_password_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_password_grants_select_self ON public.match_password_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Full roster/detail access for private matches (not bare metadata).
CREATE OR REPLACE FUNCTION public.auth_can_read_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        m.visibility IN ('public', 'link')
        OR m.creator_id = auth.uid()
        OR public.auth_is_confirmed_in_match(m.id)
        OR (
          m.visibility = 'private'
          AND EXISTS (
            SELECT 1 FROM public.match_password_grants g
            WHERE g.match_id = m.id AND g.user_id = auth.uid()
          )
        )
        OR (
          m.tournament_id IS NOT NULL
          AND public.auth_can_read_tournament(m.tournament_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.grant_match_password_access(
  p_match_id UUID,
  p_password TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_match';
  END IF;

  IF v_match.password_hash IS NULL THEN
    RAISE EXCEPTION 'match_no_password';
  END IF;

  IF crypt(p_password, v_match.password_hash) <> v_match.password_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.match_password_grants (match_id, user_id)
  VALUES (p_match_id, auth.uid())
  ON CONFLICT (match_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_match_password_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_match_password_access(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.viewer_can_access_match(p_match_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_can_read_match(p_match_id);
$$;

REVOKE ALL ON FUNCTION public.viewer_can_access_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_can_access_match(UUID) TO authenticated;

-- Joining a private match requires a prior password grant (or being the creator).
DROP POLICY IF EXISTS participants_insert_self ON public.match_participants;
CREATE POLICY participants_insert_self ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.status IN ('planned', 'in_progress')
        AND m.tournament_id IS NULL
        AND (
          m.visibility IN ('public', 'link')
          OR m.creator_id = auth.uid()
          OR (
            m.visibility = 'private'
            AND EXISTS (
              SELECT 1 FROM public.match_password_grants g
              WHERE g.match_id = m.id AND g.user_id = auth.uid()
            )
          )
        )
    )
  );
