-- 103: Recalcular ELO + agregados/logros al leer get_player_stats
-- Rebuild de ELO solo del usuario (no muta rivales). Usa el ELO actual de
-- oponentes/compañeros como aproximación histórica.

CREATE OR REPLACE FUNCTION public.rebuild_player_elo(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_team_a UUID[];
  v_team_b UUID[];
  v_elo_a NUMERIC;
  v_elo_b NUMERIC;
  v_expected_a NUMERIC;
  v_score_a NUMERIC;
  v_delta NUMERIC;
  v_running INT := 1200;
  v_uid UUID;
  k CONSTANT NUMERIC := 32;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.ensure_player_stats_row(p_user_id);

  UPDATE public.player_stats
  SET elo_rating = 1200, updated_at = NOW()
  WHERE user_id = p_user_id;

  FOR r IN
    SELECT match_id, team, team_a_games, team_b_games
    FROM public._player_confirmed_match_rows(p_user_id)
  LOOP
    IF r.team_a_games = r.team_b_games THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
    INTO v_team_a
    FROM public.match_participants mp
    WHERE mp.match_id = r.match_id AND mp.state = 'confirmed' AND mp.team = 'A';

    SELECT COALESCE(array_agg(mp.user_id), ARRAY[]::UUID[])
    INTO v_team_b
    FROM public.match_participants mp
    WHERE mp.match_id = r.match_id AND mp.state = 'confirmed' AND mp.team = 'B';

    -- Sin rivales con cuenta no hay cambio de ELO (igual que apply_match_elo)
    IF cardinality(v_team_a) = 0 OR cardinality(v_team_b) = 0 THEN
      CONTINUE;
    END IF;

    FOREACH v_uid IN ARRAY (v_team_a || v_team_b)
    LOOP
      PERFORM public.ensure_player_stats_row(v_uid);
    END LOOP;

    -- El usuario en rebuild usa v_running; rivales/compañeros, su ELO actual
    SELECT AVG(
      CASE WHEN ps.user_id = p_user_id THEN v_running ELSE ps.elo_rating END
    )::NUMERIC
    INTO v_elo_a
    FROM public.player_stats ps
    WHERE ps.user_id = ANY (v_team_a);

    SELECT AVG(
      CASE WHEN ps.user_id = p_user_id THEN v_running ELSE ps.elo_rating END
    )::NUMERIC
    INTO v_elo_b
    FROM public.player_stats ps
    WHERE ps.user_id = ANY (v_team_b);

    v_expected_a := 1.0 / (1.0 + POWER(10.0, (v_elo_b - v_elo_a) / 400.0));
    v_score_a := CASE WHEN r.team_a_games > r.team_b_games THEN 1.0 ELSE 0.0 END;

    IF r.team = 'A' THEN
      v_delta := ROUND(k * (v_score_a - v_expected_a));
    ELSE
      v_delta := ROUND(k * ((1.0 - v_score_a) - (1.0 - v_expected_a)));
    END IF;

    v_running := GREATEST(100, v_running + v_delta::INT);
  END LOOP;

  UPDATE public.player_stats
  SET elo_rating = v_running, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_player_elo(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_player_stats(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_updated TIMESTAMPTZ;
  v_last_confirmed TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Si player_stats ya está al día con el último partido confirmado, evita recalcular
  -- (aproximación de "no recalcular ELO en cada lectura").
  SELECT ps.updated_at
  INTO v_player_updated
  FROM public.player_stats ps
  WHERE ps.user_id = p_user_id;

  SELECT MAX(m.updated_at)
  INTO v_last_confirmed
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.match_results mr
    ON mr.match_id = m.id AND mr.status = 'confirmed'
  WHERE mp.user_id = p_user_id
    AND mp.state = 'confirmed';

  IF v_player_updated IS NOT NULL
     AND v_last_confirmed IS NOT NULL
     AND v_player_updated >= v_last_confirmed
  THEN
    RETURN;
  END IF;

  PERFORM public.rebuild_player_elo(p_user_id);
  PERFORM public.recompute_player_stats_aggregates(p_user_id);

  -- Quitar del showcase logros que ya no aplican
  UPDATE public.profiles p
  SET badge_showcase = COALESCE((
    SELECT array_agg(k ORDER BY ord)
    FROM unnest(p.badge_showcase) WITH ORDINALITY AS u(k, ord)
    WHERE EXISTS (
      SELECT 1
      FROM public.player_stats ps,
           jsonb_array_elements(ps.badges) b
      WHERE ps.user_id = p.id
        AND b->>'key' = k
    )
  ), '{}'::text[])
  WHERE p.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_player_stats(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.refresh_player_stats(UUID) IS
  'Recalcula ELO (solo ese usuario), agregados y logros. Se invoca desde get_player_stats.';

-- Parchear get_player_stats: ensure -> refresh (sin reescribir todo el cuerpo)
DO $patch$
DECLARE
  def text;
BEGIN
  def := pg_get_functiondef('public.get_player_stats(uuid)'::regprocedure);
  IF strpos(def, 'PERFORM public.refresh_player_stats(p_user_id);') > 0 THEN
    RETURN;
  END IF;
  IF strpos(def, 'PERFORM public.ensure_player_stats_row(p_user_id);') = 0 THEN
    RAISE EXCEPTION 'ensure_player_stats_row call not found in get_player_stats';
  END IF;
  def := replace(
    def,
    'PERFORM public.ensure_player_stats_row(p_user_id);',
    'PERFORM public.refresh_player_stats(p_user_id);'
  );
  EXECUTE def;
END;
$patch$;

ALTER FUNCTION public.get_player_stats(uuid) VOLATILE;

NOTIFY pgrst, 'reload schema';
