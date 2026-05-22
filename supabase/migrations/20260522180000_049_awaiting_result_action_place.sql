-- 049: Include venue fields in list_matches_awaiting_my_result_action for dashboard UI.

DROP FUNCTION IF EXISTS public.list_matches_awaiting_my_result_action();

CREATE OR REPLACE FUNCTION public.list_matches_awaiting_my_result_action()
RETURNS TABLE (
  id uuid,
  title text,
  start_at timestamptz,
  city text,
  place_defined boolean,
  place_text text,
  status text,
  visibility text,
  creator_id uuid,
  match_result_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.id)
    m.id,
    m.title,
    m.start_at,
    m.city,
    m.place_defined,
    m.place_text,
    m.status,
    m.visibility,
    m.creator_id,
    mr.id AS match_result_id
  FROM public.matches m
  INNER JOIN public.match_participants mp
    ON mp.match_id = m.id
   AND mp.user_id = auth.uid()
   AND mp.state = 'confirmed'
   AND mp.left_at IS NULL
  INNER JOIN public.match_results mr ON mr.match_id = m.id
  WHERE mr.status = 'pending_validation'
    AND mr.submitted_by_team <> mp.team
    AND NOT COALESCE(m.tournament_is_bye, FALSE)
    AND NOT EXISTS (
      SELECT 1
      FROM public.result_confirmations rc
      WHERE rc.match_result_id = mr.id
        AND rc.user_id = auth.uid()
    )
  ORDER BY m.id, mr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_matches_awaiting_my_result_action() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_matches_awaiting_my_result_action() TO authenticated;
