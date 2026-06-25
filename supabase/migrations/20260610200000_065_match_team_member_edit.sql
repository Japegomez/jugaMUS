-- 065: Allow match team members to edit their team roster (name + text players) while planned.

CREATE OR REPLACE FUNCTION public.match_team_text_count(m public.matches, p_team text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_team
    WHEN 'B' THEN
      (CASE WHEN NULLIF(BTRIM(m.team_b_player_1), '') IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN NULLIF(BTRIM(m.team_b_player_2), '') IS NOT NULL THEN 1 ELSE 0 END)
    ELSE
      (CASE WHEN NULLIF(BTRIM(m.team_a_player_1), '') IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN NULLIF(BTRIM(m.team_a_player_2), '') IS NOT NULL THEN 1 ELSE 0 END)
  END;
$$;

CREATE OR REPLACE FUNCTION public.match_team_registered_count(p_match_id uuid, p_team text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::integer
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team = p_team
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.update_match_team(
  p_match_id UUID,
  p_team_name TEXT,
  p_text_updates JSONB DEFAULT '{}'::jsonb
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_team text;
  v_key text;
  v_value text;
  v_custom_name text;
  v_registered_a integer;
  v_registered_b integer;
  v_text_a integer;
  v_text_b integer;
  v_allowed_keys text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.tournament_id IS NOT NULL THEN
    RAISE EXCEPTION 'tournament_match_not_editable';
  END IF;

  IF v_match.status <> 'planned' THEN
    RAISE EXCEPTION 'match_not_planned';
  END IF;

  SELECT mp.team INTO v_team
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = auth.uid()
    AND mp.state = 'confirmed'
    AND mp.left_at IS NULL
  LIMIT 1;

  IF v_team IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_team = 'B' THEN
    v_allowed_keys := ARRAY['team_b_player_1', 'team_b_player_2'];
  ELSE
    v_allowed_keys := ARRAY['team_a_player_1', 'team_a_player_2'];
  END IF;

  IF p_text_updates IS NOT NULL AND p_text_updates <> '{}'::jsonb THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_text_updates)
    LOOP
      IF NOT (v_key = ANY (v_allowed_keys)) THEN
        RAISE EXCEPTION 'invalid_text_field';
      END IF;

      v_value := NULLIF(BTRIM(v_value), '');

      IF v_key = 'team_a_player_1' THEN
        v_match.team_a_player_1 := v_value;
      ELSIF v_key = 'team_a_player_2' THEN
        v_match.team_a_player_2 := v_value;
      ELSIF v_key = 'team_b_player_1' THEN
        v_match.team_b_player_1 := v_value;
      ELSIF v_key = 'team_b_player_2' THEN
        v_match.team_b_player_2 := v_value;
      END IF;
    END LOOP;
  END IF;

  v_registered_a := public.match_team_registered_count(p_match_id, 'A');
  v_registered_b := public.match_team_registered_count(p_match_id, 'B');
  v_text_a := public.match_team_text_count(v_match, 'A');
  v_text_b := public.match_team_text_count(v_match, 'B');

  IF v_registered_a + v_text_a > 2 OR v_registered_b + v_text_b > 2 THEN
    RAISE EXCEPTION 'roster_full';
  END IF;

  v_custom_name := NULLIF(BTRIM(p_team_name), '');

  IF v_team = 'B' THEN
    v_match.team_b_name := COALESCE(v_custom_name, 'Equipo B');
  ELSE
    v_match.team_a_name := COALESCE(v_custom_name, 'Equipo A');
  END IF;

  UPDATE public.matches
  SET
    team_a_name = v_match.team_a_name,
    team_a_player_1 = v_match.team_a_player_1,
    team_a_player_2 = v_match.team_a_player_2,
    team_b_name = v_match.team_b_name,
    team_b_player_1 = v_match.team_b_player_1,
    team_b_player_2 = v_match.team_b_player_2,
    updated_at = NOW()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.update_match_team(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_match_team(UUID, TEXT, JSONB) TO authenticated;
