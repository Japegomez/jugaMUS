-- 027: Restore non-recursive matches_select (broken by 026 tournaments policy).
-- Inline EXISTS on match_participants caused infinite RLS recursion when loading
-- match_participants with embedded matches (Mis partidas → 500).

DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR public.auth_is_confirmed_in_match(id)
    OR visibility = 'link'
    OR (
      tournament_id IS NOT NULL
      AND public.auth_can_read_tournament(tournament_id)
    )
  );

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
        m.visibility = 'public'
        OR m.visibility = 'link'
        OR m.creator_id = auth.uid()
        OR public.auth_is_confirmed_in_match(m.id)
        OR (
          m.tournament_id IS NOT NULL
          AND public.auth_can_read_tournament(m.tournament_id)
        )
      )
  );
$$;
