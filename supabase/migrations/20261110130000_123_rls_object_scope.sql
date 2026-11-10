-- 123: Object-scoped RLS + column grants (Strix Medium).
-- Closes vuln-0006 / 0015 / 0017 / 0018 / 0019.
-- Guards allow auth.uid() IS NULL so service_role erasure / elevated paths still work.
-- SECURITY DEFINER writers (current_user not authenticated/anon) are not blocked.

-- ── matches: insert must own destination tournament/league ───────────────────
DROP POLICY IF EXISTS matches_insert_creator ON public.matches;
CREATE POLICY matches_insert_creator ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND (
      tournament_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = tournament_id AND t.creator_id = auth.uid()
      )
    )
    AND (
      league_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = league_id AND l.creator_id = auth.uid()
      )
    )
  );

-- ── matches: competition-scope trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_matches_competition_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_scope_changed BOOLEAN;
BEGIN
  -- service_role / no JWT (account erasure, cron without claim)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER internals run as elevated current_user
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_scope_changed :=
    NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
    OR NEW.league_id IS DISTINCT FROM OLD.league_id
    OR NEW.tournament_bracket_position IS DISTINCT FROM OLD.tournament_bracket_position
    OR NEW.tournament_round_size IS DISTINCT FROM OLD.tournament_round_size
    OR NEW.tournament_pair_a_id IS DISTINCT FROM OLD.tournament_pair_a_id
    OR NEW.tournament_pair_b_id IS DISTINCT FROM OLD.tournament_pair_b_id
    OR NEW.tournament_winner_pair_id IS DISTINCT FROM OLD.tournament_winner_pair_id
    OR NEW.tournament_is_bye IS DISTINCT FROM OLD.tournament_is_bye
    OR NEW.tournament_is_third_place IS DISTINCT FROM OLD.tournament_is_third_place
    OR NEW.league_pair_a_id IS DISTINCT FROM OLD.league_pair_a_id
    OR NEW.league_pair_b_id IS DISTINCT FROM OLD.league_pair_b_id
    OR NEW.league_round_number IS DISTINCT FROM OLD.league_round_number
    OR NEW.league_is_second_leg IS DISTINCT FROM OLD.league_is_second_leg;

  IF NOT v_scope_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.tournament_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = NEW.tournament_id AND t.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_competition_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.league_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = NEW.league_id AND l.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_competition_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Detaching from a competition (setting ids to NULL) also requires organizer of OLD
  IF NEW.tournament_id IS NULL AND OLD.tournament_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = OLD.tournament_id AND t.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_competition_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.league_id IS NULL AND OLD.league_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = OLD.league_id AND l.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_competition_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_matches_competition_scope ON public.matches;
CREATE TRIGGER trg_guard_matches_competition_scope
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_matches_competition_scope();

REVOKE ALL ON FUNCTION public.guard_matches_competition_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_matches_competition_scope() FROM anon;
REVOKE ALL ON FUNCTION public.guard_matches_competition_scope() FROM authenticated;

-- ── matches: column grants (preserve legitimate client writes) ───────────────
REVOKE INSERT, UPDATE ON TABLE public.matches FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.matches FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.matches FROM authenticated;

GRANT INSERT (
  id,
  title,
  description,
  start_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  status,
  creator_id,
  team_a_name,
  team_a_player_1,
  team_a_player_2,
  team_b_name,
  team_b_player_1,
  team_b_player_2,
  created_at,
  updated_at
) ON TABLE public.matches TO authenticated;

GRANT UPDATE (
  title,
  description,
  start_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  status,
  team_a_name,
  team_a_player_1,
  team_a_player_2,
  team_b_name,
  team_b_player_1,
  team_b_player_2,
  updated_at
) ON TABLE public.matches TO authenticated;

-- ── match_participants: update self with destination validation ──────────────
DROP POLICY IF EXISTS participants_update_self ON public.match_participants;
CREATE POLICY participants_update_self ON public.match_participants
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND (m.tournament_id IS NOT NULL OR m.league_id IS NOT NULL)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.tournament_id IS NULL
        AND m.league_id IS NULL
        AND (
          -- Leave always allowed on casual matches (join_private_match may not create a grant).
          match_participants.left_at IS NOT NULL
          OR match_participants.state = 'left'
          OR m.visibility IN ('public', 'link')
          OR m.creator_id = auth.uid()
          OR (
            m.visibility = 'private'
            AND EXISTS (
              SELECT 1 FROM public.match_password_grants g
              WHERE g.match_id = m.id AND g.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.match_participants_match_id_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.match_id IS DISTINCT FROM OLD.match_id THEN
    RAISE EXCEPTION 'match_id_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_participants_match_id_immutable ON public.match_participants;
CREATE TRIGGER trg_match_participants_match_id_immutable
  BEFORE UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.match_participants_match_id_immutable();

REVOKE ALL ON FUNCTION public.match_participants_match_id_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_participants_match_id_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.match_participants_match_id_immutable() FROM authenticated;

-- ── tournament_pairs: ownership + entry_fee_paid guards ──────────────────────
CREATE OR REPLACE FUNCTION public.guard_tournament_pair_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = NEW.tournament_id AND t.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_pair_ownership' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tournament_pair_entry_fee_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.entry_fee_paid IS DISTINCT FROM OLD.entry_fee_paid THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = NEW.tournament_id AND t.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_entry_fee_paid' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tournament_pair_ownership ON public.tournament_pairs;
CREATE TRIGGER trg_guard_tournament_pair_ownership
  BEFORE UPDATE ON public.tournament_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tournament_pair_ownership();

DROP TRIGGER IF EXISTS trg_guard_tournament_pair_entry_fee_paid ON public.tournament_pairs;
CREATE TRIGGER trg_guard_tournament_pair_entry_fee_paid
  BEFORE UPDATE ON public.tournament_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tournament_pair_entry_fee_paid();

REVOKE ALL ON FUNCTION public.guard_tournament_pair_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_tournament_pair_ownership() FROM anon;
REVOKE ALL ON FUNCTION public.guard_tournament_pair_ownership() FROM authenticated;

REVOKE ALL ON FUNCTION public.guard_tournament_pair_entry_fee_paid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_tournament_pair_entry_fee_paid() FROM anon;
REVOKE ALL ON FUNCTION public.guard_tournament_pair_entry_fee_paid() FROM authenticated;

REVOKE INSERT, UPDATE ON TABLE public.tournament_pairs FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.tournament_pairs FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.tournament_pairs FROM authenticated;

GRANT INSERT (
  id,
  name,
  name_is_custom,
  player_a_user_id,
  player_a_text,
  player_b_user_id,
  player_b_text,
  created_by_user_id,
  tournament_id,
  created_at,
  updated_at
) ON TABLE public.tournament_pairs TO authenticated;

GRANT UPDATE (
  name,
  name_is_custom,
  player_a_user_id,
  player_a_text,
  player_b_user_id,
  player_b_text,
  updated_at
) ON TABLE public.tournament_pairs TO authenticated;

-- ── league_pairs: ownership guard + column grants ────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_league_pair_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.league_id IS DISTINCT FROM OLD.league_id
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.current_elo IS DISTINCT FROM OLD.current_elo THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = NEW.league_id AND l.creator_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden_pair_ownership' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_league_pair_ownership ON public.league_pairs;
CREATE TRIGGER trg_guard_league_pair_ownership
  BEFORE UPDATE ON public.league_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_league_pair_ownership();

REVOKE ALL ON FUNCTION public.guard_league_pair_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_league_pair_ownership() FROM anon;
REVOKE ALL ON FUNCTION public.guard_league_pair_ownership() FROM authenticated;

REVOKE INSERT, UPDATE ON TABLE public.league_pairs FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.league_pairs FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.league_pairs FROM authenticated;

GRANT INSERT (
  id,
  league_id,
  name,
  name_is_custom,
  player_a_user_id,
  player_a_text,
  player_b_user_id,
  player_b_text,
  created_by_user_id,
  joined_at,
  created_at,
  updated_at
) ON TABLE public.league_pairs TO authenticated;

GRANT UPDATE (
  name,
  name_is_custom,
  player_a_user_id,
  player_a_text,
  player_b_user_id,
  player_b_text,
  updated_at
) ON TABLE public.league_pairs TO authenticated;

-- ── tournaments / leagues: creator_id + generation timestamps immutable via grants
CREATE OR REPLACE FUNCTION public.guard_tournament_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.bracket_generated_at IS DISTINCT FROM OLD.bracket_generated_at THEN
    RAISE EXCEPTION 'forbidden_tournament_identity' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_league_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.fixtures_generated_at IS DISTINCT FROM OLD.fixtures_generated_at THEN
    RAISE EXCEPTION 'forbidden_league_identity' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tournament_identity ON public.tournaments;
CREATE TRIGGER trg_guard_tournament_identity
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tournament_identity();

DROP TRIGGER IF EXISTS trg_guard_league_identity ON public.leagues;
CREATE TRIGGER trg_guard_league_identity
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_league_identity();

REVOKE ALL ON FUNCTION public.guard_tournament_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_tournament_identity() FROM anon;
REVOKE ALL ON FUNCTION public.guard_tournament_identity() FROM authenticated;

REVOKE ALL ON FUNCTION public.guard_league_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_league_identity() FROM anon;
REVOKE ALL ON FUNCTION public.guard_league_identity() FROM authenticated;

REVOKE INSERT, UPDATE ON TABLE public.tournaments FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.tournaments FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.tournaments FROM authenticated;

GRANT INSERT (
  id,
  title,
  description,
  notes,
  start_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  entry_fee,
  include_third_place,
  creator_joins_as_player,
  creator_id,
  status,
  created_at,
  updated_at
) ON TABLE public.tournaments TO authenticated;

GRANT UPDATE (
  title,
  description,
  notes,
  start_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  entry_fee,
  include_third_place,
  creator_joins_as_player,
  status,
  updated_at
) ON TABLE public.tournaments TO authenticated;

REVOKE INSERT, UPDATE ON TABLE public.leagues FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.leagues FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.leagues FROM authenticated;

GRANT INSERT (
  id,
  title,
  description,
  notes,
  start_at,
  end_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  format,
  elo_initial,
  elo_k_factor,
  creator_id,
  status,
  created_at,
  updated_at
) ON TABLE public.leagues TO authenticated;

GRANT UPDATE (
  title,
  description,
  notes,
  start_at,
  end_at,
  city,
  place_defined,
  place_text,
  location_privacy,
  duration_target_games,
  visibility,
  format,
  elo_initial,
  elo_k_factor,
  status,
  updated_at
) ON TABLE public.leagues TO authenticated;

NOTIFY pgrst, 'reload schema';
