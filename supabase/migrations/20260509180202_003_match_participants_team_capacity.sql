CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  state TEXT NOT NULL DEFAULT 'confirmed' CHECK (state IN ('confirmed', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE (match_id, user_id)
);

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

CREATE TRIGGER match_participants_team_capacity
  BEFORE INSERT OR UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_capacity();
