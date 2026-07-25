-- 073: Tournament entry fee (inscripción) — optional amount with up to 2 decimals.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS entry_fee NUMERIC(10, 2)
  CHECK (entry_fee IS NULL OR entry_fee >= 0);

COMMENT ON COLUMN public.tournaments.entry_fee IS
  'Optional registration fee (euros). Null means not specified.';

DROP FUNCTION IF EXISTS public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.create_tournament(
  p_title TEXT,
  p_start_at TIMESTAMPTZ,
  p_city TEXT,
  p_duration_target_games INT,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_place_defined BOOLEAN DEFAULT TRUE,
  p_place_text TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_location_privacy TEXT DEFAULT 'participants_only',
  p_creator_joins_as_player BOOLEAN DEFAULT FALSE,
  p_include_third_place BOOLEAN DEFAULT FALSE,
  p_entry_fee NUMERIC DEFAULT NULL
)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournaments%ROWTYPE;
  v_title TEXT;
  v_city TEXT;
  v_fee NUMERIC(10, 2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_entry_fee IS NOT NULL AND p_entry_fee < 0 THEN
    RAISE EXCEPTION 'invalid_entry_fee';
  END IF;

  v_title := COALESCE(NULLIF(BTRIM(p_title), ''), 'Torneo');
  v_city := COALESCE(NULLIF(BTRIM(p_city), ''), 'Ciudad por definir');
  v_fee := CASE
    WHEN p_entry_fee IS NULL THEN NULL
    ELSE ROUND(p_entry_fee::NUMERIC, 2)
  END;

  INSERT INTO public.tournaments (
    title,
    description,
    notes,
    start_at,
    city,
    place_defined,
    place_text,
    duration_target_games,
    visibility,
    location_privacy,
    creator_id,
    creator_joins_as_player,
    include_third_place,
    entry_fee,
    status
  ) VALUES (
    v_title,
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_notes), ''),
    p_start_at,
    v_city,
    COALESCE(p_place_defined, TRUE),
    CASE WHEN COALESCE(p_place_defined, TRUE) THEN NULLIF(BTRIM(p_place_text), '') ELSE NULL END,
    p_duration_target_games,
    COALESCE(p_visibility, 'public'),
    COALESCE(p_location_privacy, 'participants_only'),
    auth.uid(),
    COALESCE(p_creator_joins_as_player, FALSE),
    COALESCE(p_include_third_place, FALSE),
    v_fee,
    'registration'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, NUMERIC
) TO authenticated;
