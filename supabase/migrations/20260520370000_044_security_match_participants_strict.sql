-- 044: Stricter match join rules — planned status, public/link visibility, max 4 confirmed.

CREATE OR REPLACE FUNCTION public.enforce_match_total_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_confirmed INT;
BEGIN
  IF NEW.state <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INT INTO v_confirmed
  FROM public.match_participants mp
  WHERE mp.match_id = NEW.match_id
    AND mp.state = 'confirmed'
    AND mp.id IS DISTINCT FROM NEW.id;

  IF v_confirmed >= 4 THEN
    RAISE EXCEPTION 'match_full';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_match_total_capacity ON public.match_participants;
CREATE TRIGGER trg_enforce_match_total_capacity
  BEFORE INSERT OR UPDATE OF state ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_total_capacity();

DROP POLICY IF EXISTS participants_insert_self ON public.match_participants;
CREATE POLICY participants_insert_self ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.status = 'planned'
        AND m.visibility IN ('public', 'link')
        AND m.tournament_id IS NULL
    )
  );
