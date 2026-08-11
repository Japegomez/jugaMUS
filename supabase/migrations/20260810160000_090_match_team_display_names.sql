-- 090: Fix league/tournament match team names showing "Jugador" for registered players.

CREATE OR REPLACE FUNCTION public.league_pair_display_name(p_pair public.league_pairs)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_pair.name_is_custom THEN p_pair.name
    ELSE public.league_pair_slot_label(p_pair.player_a_user_id, p_pair.player_a_text)
      || ' - '
      || public.league_pair_slot_label(p_pair.player_b_user_id, p_pair.player_b_text)
  END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_pair_display_name(p_pair public.tournament_pairs)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_pair.name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))' THEN
      public.league_pair_slot_label(p_pair.player_a_user_id, p_pair.player_a_text)
      || ' - '
      || public.league_pair_slot_label(p_pair.player_b_user_id, p_pair.player_b_text)
    ELSE p_pair.name
  END;
$$;

CREATE OR REPLACE FUNCTION public.populate_match_roster_from_league_pair(
  p_match_id UUID,
  p_pair_id UUID,
  p_team TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.league_pairs%ROWTYPE;
  v_display_name TEXT;
BEGIN
  SELECT * INTO v_pair FROM public.league_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_display_name := public.league_pair_display_name(v_pair);

  IF p_team = 'A' THEN
    UPDATE public.matches
    SET
      team_a_name = v_display_name,
      team_a_player_1 = v_pair.player_a_text,
      team_a_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  ELSE
    UPDATE public.matches
    SET
      team_b_name = v_display_name,
      team_b_player_1 = v_pair.player_a_text,
      team_b_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_match_roster_from_pair(
  p_match_id UUID,
  p_pair_id UUID,
  p_team TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair public.tournament_pairs%ROWTYPE;
  v_display_name TEXT;
BEGIN
  SELECT * INTO v_pair FROM public.tournament_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_display_name := public.tournament_pair_display_name(v_pair);

  IF p_team = 'A' THEN
    UPDATE public.matches
    SET
      team_a_name = v_display_name,
      team_a_player_1 = v_pair.player_a_text,
      team_a_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'A')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'A', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  ELSE
    UPDATE public.matches
    SET
      team_b_name = v_display_name,
      team_b_player_1 = v_pair.player_a_text,
      team_b_player_2 = v_pair.player_b_text
    WHERE id = p_match_id;

    IF v_pair.player_a_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_a_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
    IF v_pair.player_b_user_id IS NOT NULL THEN
      INSERT INTO public.match_participants (match_id, user_id, team)
      VALUES (p_match_id, v_pair.player_b_user_id, 'B')
      ON CONFLICT (match_id, user_id) DO UPDATE
        SET team = 'B', state = 'confirmed', left_at = NULL, joined_at = NOW();
    END IF;
  END IF;
END;
$$;

-- Backfill auto-generated league pair names still using "Jugador".
UPDATE public.league_pairs lp
SET name = public.league_pair_display_name(lp)
WHERE NOT lp.name_is_custom
  AND lp.name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))';

-- Backfill match team names from linked pairs.
UPDATE public.matches m
SET team_a_name = public.league_pair_display_name(lp)
FROM public.league_pairs lp
WHERE m.league_pair_a_id = lp.id
  AND m.league_id IS NOT NULL
  AND m.status IN ('planned', 'in_progress')
  AND m.team_a_name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))';

UPDATE public.matches m
SET team_b_name = public.league_pair_display_name(lp)
FROM public.league_pairs lp
WHERE m.league_pair_b_id = lp.id
  AND m.league_id IS NOT NULL
  AND m.status IN ('planned', 'in_progress')
  AND m.team_b_name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))';

UPDATE public.matches m
SET team_a_name = public.tournament_pair_display_name(tp)
FROM public.tournament_pairs tp
WHERE m.tournament_pair_a_id = tp.id
  AND m.tournament_id IS NOT NULL
  AND m.status IN ('planned', 'in_progress')
  AND m.team_a_name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))';

UPDATE public.matches m
SET team_b_name = public.tournament_pair_display_name(tp)
FROM public.tournament_pairs tp
WHERE m.tournament_pair_b_id = tp.id
  AND m.tournament_id IS NOT NULL
  AND m.status IN ('planned', 'in_progress')
  AND m.team_b_name ~ '(^Jugador(\s|$|-)|-\s*Jugador(\s|$))';
