-- 067: Private tournaments with password access (mirrors match private flow).

-- 1. password_hash on tournaments + extend visibility constraint.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_visibility_check,
  ADD CONSTRAINT tournaments_visibility_check
    CHECK (visibility IN ('public', 'link', 'private'));

-- 2. Grants table: users who verified the tournament password.
CREATE TABLE IF NOT EXISTS public.tournament_password_grants (
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, user_id)
);

ALTER TABLE public.tournament_password_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tournament_password_grants_select_self ON public.tournament_password_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. tournaments_select: private rows visible in explore (metadata only via RLS on pairs).
DROP POLICY IF EXISTS tournaments_select ON public.tournaments;
CREATE POLICY tournaments_select ON public.tournaments
  FOR SELECT TO authenticated USING (
    visibility IN ('public', 'private')
    OR creator_id = auth.uid()
    OR visibility = 'link'
    OR EXISTS (
      SELECT 1 FROM public.tournament_pairs tp
      WHERE tp.tournament_id = tournaments.id
        AND (
          tp.player_a_user_id = auth.uid()
          OR tp.player_b_user_id = auth.uid()
          OR tp.created_by_user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_password_grants g
      WHERE g.tournament_id = tournaments.id AND g.user_id = auth.uid()
    )
  );

-- 4. auth_can_read_tournament: full access (pairs, bracket) — not bare private.
CREATE OR REPLACE FUNCTION public.auth_can_read_tournament(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND (
        t.visibility = 'public'
        OR t.visibility = 'link'
        OR t.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.tournament_pairs tp
          WHERE tp.tournament_id = t.id
            AND (
              tp.player_a_user_id = auth.uid()
              OR tp.player_b_user_id = auth.uid()
              OR tp.created_by_user_id = auth.uid()
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.tournament_password_grants g
          WHERE g.tournament_id = t.id AND g.user_id = auth.uid()
        )
      )
  );
$$;

-- 5. set_tournament_password
CREATE OR REPLACE FUNCTION public.set_tournament_password(
  p_tournament_id UUID,
  p_password      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_password), '') IS NULL THEN
    RAISE EXCEPTION 'password_empty';
  END IF;

  UPDATE public.tournaments
  SET
    password_hash = crypt(p_password, gen_salt('bf', 10)),
    updated_at = NOW()
  WHERE id = p_tournament_id
    AND creator_id = auth.uid()
    AND visibility = 'private';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tournament_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tournament_password(UUID, TEXT) TO authenticated;

-- 6. grant_tournament_password_access: verify password and grant full read access.
CREATE OR REPLACE FUNCTION public.grant_tournament_password_access(
  p_tournament_id UUID,
  p_password      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF v_tournament.visibility <> 'private' THEN
    RAISE EXCEPTION 'not_private_tournament';
  END IF;

  IF v_tournament.password_hash IS NULL THEN
    RAISE EXCEPTION 'tournament_no_password';
  END IF;

  IF crypt(p_password, v_tournament.password_hash) <> v_tournament.password_hash THEN
    RAISE EXCEPTION 'wrong_password';
  END IF;

  INSERT INTO public.tournament_password_grants (tournament_id, user_id)
  VALUES (p_tournament_id, auth.uid())
  ON CONFLICT (tournament_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tournament_password_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_tournament_password_access(UUID, TEXT) TO authenticated;

-- 7. Expose access check for client gating.
CREATE OR REPLACE FUNCTION public.viewer_can_access_tournament(p_tournament_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_can_read_tournament(p_tournament_id);
$$;

REVOKE ALL ON FUNCTION public.viewer_can_access_tournament(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_can_access_tournament(UUID) TO authenticated;
