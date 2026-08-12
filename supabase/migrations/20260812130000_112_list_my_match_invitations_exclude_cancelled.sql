-- Exclude invitations whose match was cancelled (belt + suspenders with cancel trigger).
-- list_my_match_invitations.status remains the match status for client display/filtering.

CREATE OR REPLACE FUNCTION public.list_my_match_invitations()
RETURNS TABLE (
  invitation_id UUID,
  match_id      UUID,
  title         TEXT,
  start_at      TIMESTAMPTZ,
  status        TEXT,
  inviter_id    UUID,
  inviter_name  TEXT,
  team          TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mi.id AS invitation_id,
    mi.match_id,
    m.title,
    m.start_at,
    m.status,
    mi.inviter_id,
    p.display_name AS inviter_name,
    mi.team,
    mi.created_at
  FROM public.match_invitations mi
  JOIN public.matches m ON m.id = mi.match_id
  JOIN public.profiles p ON p.id = mi.inviter_id
  WHERE mi.invitee_id = auth.uid()
    AND mi.status = 'pending'
    AND m.status <> 'cancelled'
  ORDER BY mi.created_at DESC;
$$;
