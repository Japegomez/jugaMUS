-- 074: Track whether a tournament pair has paid the entry fee.

ALTER TABLE public.tournament_pairs
  ADD COLUMN IF NOT EXISTS entry_fee_paid BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tournament_pairs.entry_fee_paid IS
  'Whether the pair has paid the tournament entry fee.';

DROP FUNCTION IF EXISTS public.update_tournament_pair(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_tournament_pair(
  p_pair_id UUID,
  p_name TEXT,
  p_player_a_text TEXT,
  p_player_b_text TEXT,
  p_entry_fee_paid BOOLEAN DEFAULT NULL
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
  v_entry_fee_paid BOOLEAN;
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
    IF v_pair.player_a_text IS NOT NULL AND v_a_text IS NULL THEN
      RAISE EXCEPTION 'cannot_clear_text_player';
    END IF;
  ELSE
    v_a_text := v_pair.player_a_text;
  END IF;

  IF v_pair.player_b_user_id IS NULL THEN
    v_b_text := NULLIF(BTRIM(p_player_b_text), '');
    IF v_pair.player_b_text IS NOT NULL AND v_b_text IS NULL THEN
      RAISE EXCEPTION 'cannot_clear_text_player';
    END IF;
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

  v_entry_fee_paid := COALESCE(p_entry_fee_paid, v_pair.entry_fee_paid);

  UPDATE public.tournament_pairs
  SET
    name = v_name,
    name_is_custom = v_custom,
    player_a_text = v_a_text,
    player_b_text = v_b_text,
    entry_fee_paid = v_entry_fee_paid,
    updated_at = NOW()
  WHERE id = p_pair_id
  RETURNING * INTO v_pair;

  RETURN v_pair;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tournament_pair(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tournament_pair(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
