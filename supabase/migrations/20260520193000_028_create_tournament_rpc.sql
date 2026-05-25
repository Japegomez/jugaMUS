-- 028: create_tournament RPC — creator_id from auth.uid() (avoids RLS mismatch on direct INSERT).

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
  p_creator_joins_as_player BOOLEAN DEFAULT FALSE
)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tournaments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF NULLIF(BTRIM(p_city), '') IS NULL THEN
    RAISE EXCEPTION 'city_required';
  END IF;

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
    status
  ) VALUES (
    BTRIM(p_title),
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_notes), ''),
    p_start_at,
    BTRIM(p_city),
    COALESCE(p_place_defined, TRUE),
    CASE WHEN COALESCE(p_place_defined, TRUE) THEN NULLIF(BTRIM(p_place_text), '') ELSE NULL END,
    p_duration_target_games,
    COALESCE(p_visibility, 'public'),
    COALESCE(p_location_privacy, 'participants_only'),
    auth.uid(),
    COALESCE(p_creator_joins_as_player, FALSE),
    'registration'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;
