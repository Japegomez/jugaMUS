-- 062: Allow tournament pair members to edit their pair during registration.

CREATE OR REPLACE FUNCTION public.update_tournament_pair(
  p_pair_id UUID,
  p_name TEXT,
  p_player_a_text TEXT,
  p_player_b_text TEXT
)
RETURNS public.tournament_pairs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_custom_name TEXT;
  v_name TEXT;
  v_custom BOOLEAN;
  v_a_text TEXT;
  v_b_text TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pair_not_found';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_pair.tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF v_tournament.creator_id <> auth.uid()
     AND v_pair.player_a_user_id IS DISTINCT FROM auth.uid()
     AND v_pair.player_b_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tournament.status <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_in_registration';
  END IF;

  IF v_tournament.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'bracket_already_generated';
  END IF;

  v_custom_name := NULLIF(BTRIM(p_name), '');
  v_custom := v_custom_name IS NOT NULL;

  IF v_pair.player_a_user_id IS NULL THEN
    v_a_text := NULLIF(BTRIM(p_player_a_text), '');
  ELSE
    v_a_text := v_pair.player_a_text;
  END IF;

  IF v_pair.player_b_user_id IS NULL THEN
    v_b_text := NULLIF(BTRIM(p_player_b_text), '');
  ELSE
    v_b_text := v_pair.player_b_text;
  END IF;

  IF v_custom THEN
    v_name := v_custom_name;
  ELSE
    v_name := public.tournament_pair_derived_name(
      v_pair.player_a_user_id,
      v_a_text,
      v_pair.player_b_user_id,
      v_b_text
    );
  END IF;

  UPDATE public.tournament_pairs
  SET
    name = v_name,
    name_is_custom = v_custom,
    player_a_text = v_a_text,
    player_b_text = v_b_text,
    updated_at = NOW()
  WHERE id = p_pair_id
  RETURNING * INTO v_pair;

  RETURN v_pair;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tournament_pair(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tournament_pair(UUID, TEXT, TEXT, TEXT) TO authenticated;
