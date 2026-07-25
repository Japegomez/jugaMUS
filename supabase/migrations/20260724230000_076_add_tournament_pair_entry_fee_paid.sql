-- 076: Allow setting entry_fee_paid when adding a tournament pair.

DROP FUNCTION IF EXISTS public.add_tournament_pair(UUID, TEXT, UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.add_tournament_pair(
  p_tournament_id UUID,
  p_name TEXT,
  p_player_a_user_id UUID DEFAULT NULL,
  p_player_a_text TEXT DEFAULT NULL,
  p_player_b_user_id UUID DEFAULT NULL,
  p_player_b_text TEXT DEFAULT NULL,
  p_entry_fee_paid BOOLEAN DEFAULT FALSE
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament public.tournaments%ROWTYPE;
  v_row public.tournament_pairs%ROWTYPE;
  v_custom_name TEXT;
  v_name TEXT;
  v_custom BOOLEAN;
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

  v_custom_name := NULLIF(BTRIM(p_name), '');
  v_custom := v_custom_name IS NOT NULL;
  v_name := COALESCE(
    v_custom_name,
    public.tournament_pair_derived_name(
      p_player_a_user_id,
      NULLIF(BTRIM(p_player_a_text), ''),
      p_player_b_user_id,
      NULLIF(BTRIM(p_player_b_text), '')
    )
  );

  INSERT INTO public.tournament_pairs (
    tournament_id, name, name_is_custom,
    player_a_user_id, player_a_text,
    player_b_user_id, player_b_text,
    entry_fee_paid,
    created_by_user_id
  ) VALUES (
    p_tournament_id, v_name, v_custom,
    p_player_a_user_id, NULLIF(BTRIM(p_player_a_text), ''),
    p_player_b_user_id, NULLIF(BTRIM(p_player_b_text), ''),
    COALESCE(p_entry_fee_paid, FALSE),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_tournament_pair(UUID, TEXT, UUID, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_tournament_pair(UUID, TEXT, UUID, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;
