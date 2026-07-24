-- 075: Organizer can manually cancel a tournament; associated open matches are cancelled too.

CREATE OR REPLACE FUNCTION public.cancel_tournament(p_tournament_id UUID)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_tournament_id IS NULL THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF v_tournament.creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tournament.status NOT IN ('registration', 'in_progress') THEN
    RAISE EXCEPTION 'tournament_not_cancellable';
  END IF;

  UPDATE public.matches
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE tournament_id = p_tournament_id
    AND status IN ('planned', 'in_progress');

  UPDATE public.tournaments
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_tournament_id
  RETURNING * INTO v_tournament;

  FOR v_user_id IN
    SELECT DISTINCT uid
    FROM (
      SELECT tp.player_a_user_id AS uid
      FROM public.tournament_pairs tp
      WHERE tp.tournament_id = p_tournament_id
        AND tp.player_a_user_id IS NOT NULL
      UNION
      SELECT tp.player_b_user_id AS uid
      FROM public.tournament_pairs tp
      WHERE tp.tournament_id = p_tournament_id
        AND tp.player_b_user_id IS NOT NULL
    ) players
    WHERE uid IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM public.enqueue_notification(
      p_user_id       := v_user_id,
      p_type          := 'tournament_cancelled',
      p_title         := 'Torneo cancelado',
      p_body          := 'El torneo «' || v_tournament.title
        || '» ha sido cancelado por el organizador.',
      p_payload_json  := jsonb_build_object('tournament_id', p_tournament_id)
    );
  END LOOP;

  RETURN v_tournament;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_tournament(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_tournament(UUID) TO authenticated;
