-- Admins can view private (password-protected) matches, tournaments and leagues
-- without entering a password.

CREATE OR REPLACE FUNCTION public.auth_can_read_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        public.auth_is_admin()
        OR m.visibility IN ('public', 'link')
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
        OR (
          m.league_id IS NOT NULL
          AND public.auth_can_read_league(m.league_id)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.auth_can_read_tournament(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND (
        public.auth_is_admin()
        OR t.visibility = 'public'
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
$function$;

CREATE OR REPLACE FUNCTION public.auth_can_read_league(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = p_league_id
      AND (
        public.auth_is_admin()
        OR l.visibility = 'public'
        OR l.visibility = 'link'
        OR l.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.league_pairs lp
          WHERE lp.league_id = l.id
            AND (
              lp.player_a_user_id = auth.uid()
              OR lp.player_b_user_id = auth.uid()
              OR lp.created_by_user_id = auth.uid()
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.league_password_grants g
          WHERE g.league_id = l.id AND g.user_id = auth.uid()
        )
      )
  );
$function$;

NOTIFY pgrst, 'reload schema';
