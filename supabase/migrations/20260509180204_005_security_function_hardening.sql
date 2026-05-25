REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_profile_with_phone(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_with_phone(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_matches_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_team_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state = 'confirmed' THEN
      SELECT COUNT(*) INTO cnt
      FROM public.match_participants
      WHERE match_id = NEW.match_id
        AND team = NEW.team
        AND state = 'confirmed';
      IF cnt >= 2 THEN
        RAISE EXCEPTION 'team_capacity_exceeded: maximum 2 confirmed players per team';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.state = 'confirmed' AND (OLD.state IS DISTINCT FROM 'confirmed') THEN
      SELECT COUNT(*) INTO cnt
      FROM public.match_participants
      WHERE match_id = NEW.match_id
        AND team = NEW.team
        AND state = 'confirmed'
        AND id IS DISTINCT FROM NEW.id;
      IF cnt >= 2 THEN
        RAISE EXCEPTION 'team_capacity_exceeded: maximum 2 confirmed players per team';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
