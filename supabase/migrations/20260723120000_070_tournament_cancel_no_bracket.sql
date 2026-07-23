-- 070: Auto-cancel registration tournaments past start_at without a bracket;
-- allow empty title/city on create_tournament (defaults like matches).

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
  p_include_third_place BOOLEAN DEFAULT FALSE
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_title := COALESCE(NULLIF(BTRIM(p_title), ''), 'Torneo');
  v_city := COALESCE(NULLIF(BTRIM(p_city), ''), 'Ciudad por definir');

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
    'registration'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tournament(
  TEXT, TIMESTAMPTZ, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_tournament_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match         RECORD;
  v_tournament    RECORD;
  v_tournament_id UUID;
BEGIN
  -- Bracket matches past start with incomplete roster → cancelled.
  FOR v_match IN
    SELECT m.id, m.tournament_id
    FROM public.matches m
    WHERE m.status = 'planned'
      AND m.tournament_id IS NOT NULL
      AND m.start_at <= NOW()
      AND COALESCE(m.tournament_is_bye, FALSE) = FALSE
      AND m.tournament_pair_a_id IS NOT NULL
      AND m.tournament_pair_b_id IS NOT NULL
      AND public.match_effective_roster_filled(m.id) < 4
  LOOP
    UPDATE public.matches SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_match.id;

    INSERT INTO public.match_state_transitions
      (match_id, from_status, to_status, triggered_by, reason)
    VALUES
      (v_match.id, 'planned', 'cancelled', 'system', 'insufficient_players_at_start');

    PERFORM public.cancel_tournament_if_unplayable(v_match.tournament_id);
  END LOOP;

  -- Registration tournaments past start without organized bracket → cancelled.
  FOR v_tournament IN
    SELECT t.id, t.title, t.creator_id
    FROM public.tournaments t
    WHERE t.status = 'registration'
      AND t.start_at <= NOW()
      AND t.bracket_generated_at IS NULL
  LOOP
    UPDATE public.tournaments
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_tournament.id
      AND status = 'registration';

    PERFORM public.enqueue_notification(
      p_user_id       := v_tournament.creator_id,
      p_type          := 'tournament_cancelled',
      p_title         := 'Torneo cancelado',
      p_body          := 'El torneo «' || v_tournament.title
        || '» se canceló al llegar la hora de inicio sin cuadro organizado.',
      p_payload_json  := jsonb_build_object('tournament_id', v_tournament.id)
    );
  END LOOP;

  FOR v_tournament_id IN
    SELECT t.id FROM public.tournaments t WHERE t.status = 'in_progress'
  LOOP
    PERFORM public.cancel_tournament_if_unplayable(v_tournament_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_tournament_lifecycle() FROM authenticated;
