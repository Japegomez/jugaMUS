-- 043: Tournament pairs — registered slots must be auth.uid() (no assigning third parties).

CREATE OR REPLACE FUNCTION public.add_tournament_pair(
  p_tournament_id UUID,
  p_name TEXT,
  p_player_a_user_id UUID DEFAULT NULL,
  p_player_a_text TEXT DEFAULT NULL,
  p_player_b_user_id UUID DEFAULT NULL,
  p_player_b_text TEXT DEFAULT NULL
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_row public.tournament_pairs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF v_tournament.status <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_in_registration';
  END IF;
  IF NOT public.auth_can_read_tournament(p_tournament_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NULLIF(BTRIM(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'pair_name_required';
  END IF;

  IF p_player_a_user_id IS NOT NULL AND p_player_a_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'cannot_assign_other_user';
  END IF;

  IF p_player_b_user_id IS NOT NULL AND p_player_b_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'cannot_assign_other_user';
  END IF;

  IF p_player_a_user_id IS NOT NULL
     AND public.user_is_in_tournament_pair(p_tournament_id, p_player_a_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  IF p_player_b_user_id IS NOT NULL
     AND public.user_is_in_tournament_pair(p_tournament_id, p_player_b_user_id) THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  IF p_player_a_user_id IS NOT NULL
     AND p_player_b_user_id IS NOT NULL
     AND p_player_a_user_id = p_player_b_user_id THEN
    RAISE EXCEPTION 'already_in_pair';
  END IF;

  INSERT INTO public.tournament_pairs (
    tournament_id, name,
    player_a_user_id, player_a_text,
    player_b_user_id, player_b_text,
    created_by_user_id
  ) VALUES (
    p_tournament_id, BTRIM(p_name),
    p_player_a_user_id, NULLIF(BTRIM(p_player_a_text), ''),
    p_player_b_user_id, NULLIF(BTRIM(p_player_b_text), ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tournament_pair(
  p_pair_id UUID,
  p_slot TEXT,
  p_as_text TEXT DEFAULT NULL
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pair_not_found'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_pair.tournament_id;
  IF v_tournament.status <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_in_registration';
  END IF;
  IF NOT public.auth_can_read_tournament(v_pair.tournament_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_as_text IS NULL OR NULLIF(BTRIM(p_as_text), '') IS NULL THEN
    IF public.user_is_in_tournament_pair(v_pair.tournament_id, auth.uid(), p_pair_id) THEN
      RAISE EXCEPTION 'already_in_pair';
    END IF;
    IF (p_slot = 'a' AND v_pair.player_b_user_id = auth.uid())
       OR (p_slot = 'b' AND v_pair.player_a_user_id = auth.uid()) THEN
      RAISE EXCEPTION 'already_in_pair';
    END IF;
  END IF;

  IF p_slot = 'a' THEN
    IF v_pair.player_a_user_id IS NOT NULL OR v_pair.player_a_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.tournament_pairs SET player_a_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.tournament_pairs SET player_a_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSIF p_slot = 'b' THEN
    IF v_pair.player_b_user_id IS NOT NULL OR v_pair.player_b_text IS NOT NULL THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    IF p_as_text IS NOT NULL AND NULLIF(BTRIM(p_as_text), '') IS NOT NULL THEN
      UPDATE public.tournament_pairs SET player_b_text = BTRIM(p_as_text) WHERE id = p_pair_id;
    ELSE
      UPDATE public.tournament_pairs SET player_b_user_id = auth.uid() WHERE id = p_pair_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  RETURN v_pair;
END;
$$;
