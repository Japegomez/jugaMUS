-- Security regression assertions for Strix High/Medium fixes (migrations 122–126).
-- Runs as postgres; switches to anon/authenticated with JWT claim for PoCs.

CREATE SCHEMA IF NOT EXISTS security_assert;
GRANT USAGE ON SCHEMA security_assert TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security_assert.fail(p_msg TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ASSERT FAIL: %', p_msg;
END;
$$;

CREATE OR REPLACE FUNCTION security_assert.pass(p_msg TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE 'PASS: %', p_msg;
END;
$$;

CREATE OR REPLACE FUNCTION security_assert.set_jwt(p_uid UUID, p_role TEXT DEFAULT 'authenticated')
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
END;
$$;

CREATE OR REPLACE FUNCTION security_assert.clear_jwt()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END;
$$;

-- INVOKER rights on purpose: EXECUTE of p_sql must run as the SET ROLE caller
-- (anon/authenticated) so revoke/RLS denials are real.
CREATE OR REPLACE FUNCTION security_assert.expect_permission_denied(p_label TEXT, p_sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    PERFORM security_assert.fail(p_label || ' — expected permission denied, but call succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM security_assert.pass(p_label);
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%permission denied%' OR SQLSTATE = '42501' THEN
        PERFORM security_assert.pass(p_label);
      ELSE
        RAISE EXCEPTION 'ASSERT FAIL: % — unexpected error: [%] %', p_label, SQLSTATE, SQLERRM;
      END IF;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION security_assert.expect_blocked(p_label TEXT, p_sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    PERFORM security_assert.fail(p_label || ' — expected RLS/trigger/privilege block, but succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM security_assert.pass(p_label);
    WHEN check_violation THEN
      PERFORM security_assert.pass(p_label);
    WHEN OTHERS THEN
      IF SQLSTATE = '42501'
         OR SQLERRM ILIKE '%permission denied%'
         OR SQLERRM ILIKE '%forbidden%'
         OR SQLERRM ILIKE '%immutable%'
         OR SQLERRM ILIKE '%violates row-level security%'
      THEN
        PERFORM security_assert.pass(p_label);
      ELSE
        RAISE EXCEPTION 'ASSERT FAIL: % — unexpected error: [%] %', p_label, SQLSTATE, SQLERRM;
      END IF;
  END;
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security_assert TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security_assert.seed_user(
  p_id UUID,
  p_email TEXT,
  p_display TEXT,
  p_role TEXT DEFAULT 'user'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    crypt('test-password-not-used', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display, 'phone_e164', '+34600000000'),
    NOW(),
    NOW(),
    FALSE,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  -- Role/status are guarded by trg_guard_profiles_privileged_columns (requires
  -- auth_is_admin). Seed as table owner with the trigger disabled.
  ALTER TABLE public.profiles DISABLE TRIGGER trg_guard_profiles_privileged_columns;
  UPDATE public.profiles
  SET display_name = p_display,
      role = p_role,
      status = 'active',
      city = 'Madrid'
  WHERE id = p_id;
  ALTER TABLE public.profiles ENABLE TRIGGER trg_guard_profiles_privileged_columns;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_organizer UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_joiner    UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_attacker  UUID := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_admin     UUID := 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
  v_victim    UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  v_extra     UUID := 'ffffffff-ffff-4fff-8fff-fffffffffff1';

  v_match_id UUID;
  v_private_match_id UUID;
  v_tournament_id UUID;
  v_tournament_b_id UUID;
  v_pair_id UUID;
  v_pair_b_id UUID;
  v_league_id UUID;
  v_lp1 UUID;
  v_lp2 UUID;
  v_dummy UUID := '00000000-0000-4000-8000-000000000099';
  v_banned TIMESTAMPTZ;
  v_status TEXT;
  v_fn RECORD;
  v_bad INT := 0;
BEGIN
  PERFORM security_assert.seed_user(v_organizer, 'organizer@test.jugamus.invalid', 'Organizer');
  PERFORM security_assert.seed_user(v_joiner, 'joiner@test.jugamus.invalid', 'Joiner');
  PERFORM security_assert.seed_user(v_attacker, 'attacker@test.jugamus.invalid', 'Attacker');
  PERFORM security_assert.seed_user(v_admin, 'admin@test.jugamus.invalid', 'Admin', 'admin');
  PERFORM security_assert.seed_user(v_victim, 'victim@test.jugamus.invalid', 'Victim');
  PERFORM security_assert.seed_user(v_extra, 'extra@test.jugamus.invalid', 'Extra');

  -- ── Anon EXECUTE denials (vuln-0002/0004/0005/0007/0008/0010) ───────────────
  PERFORM security_assert.clear_jwt();
  SET ROLE anon;

  PERFORM security_assert.expect_permission_denied(
    'anon apply_match_elo',
    format('SELECT public.apply_match_elo(%L::uuid)', v_dummy)
  );
  PERFORM security_assert.expect_permission_denied(
    'anon populate_match_roster_from_pair',
    format('SELECT public.populate_match_roster_from_pair(%L::uuid, %L::uuid, %L)', v_dummy, v_dummy, 'A')
  );
  PERFORM security_assert.expect_permission_denied(
    'anon populate_match_roster_from_league_pair',
    format('SELECT public.populate_match_roster_from_league_pair(%L::uuid, %L::uuid, %L)', v_dummy, v_dummy, 'A')
  );
  PERFORM security_assert.expect_permission_denied(
    'anon cancel_all_tournament_matches',
    format('SELECT public.cancel_all_tournament_matches(%L::uuid)', v_dummy)
  );
  PERFORM security_assert.expect_permission_denied(
    'anon cancel_all_league_matches',
    format('SELECT public.cancel_all_league_matches(%L::uuid)', v_dummy)
  );
  PERFORM security_assert.expect_permission_denied(
    'anon backfill_player_stats',
    'SELECT public.backfill_player_stats()'
  );
  PERFORM security_assert.expect_permission_denied(
    'anon create_league_match',
    format(
      'SELECT public.create_league_match(NULL::public.leagues, %L::uuid, %L::uuid, 1, false)',
      v_dummy, v_dummy
    )
  );
  PERFORM security_assert.expect_permission_denied(
    'anon maybe_finish_tournament',
    format('SELECT public.maybe_finish_tournament(%L::uuid)', v_dummy)
  );
  PERFORM security_assert.expect_permission_denied(
    'anon get_player_ranking',
    format('SELECT public.get_player_ranking(%L::uuid)', v_organizer)
  );

  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- Inventory: listed internal helpers must not be executable by anon
  FOR v_fn IN
    SELECT * FROM (VALUES
      ('public.apply_match_elo(uuid)'),
      ('public.backfill_player_stats()'),
      ('public.cancel_all_tournament_matches(uuid, text)'),
      ('public.cancel_all_league_matches(uuid)'),
      ('public.populate_match_roster_from_pair(uuid, uuid, text)'),
      ('public.populate_match_roster_from_league_pair(uuid, uuid, text)'),
      ('public.create_league_match(public.leagues, uuid, uuid, integer, boolean)'),
      ('public.maybe_finish_tournament(uuid)'),
      ('public.get_player_ranking(uuid)'),
      ('public.advance_tournament_round(uuid)'),
      ('public.propagate_tournament_winners(uuid)'),
      ('public.finalize_tournament_if_final_match(uuid)'),
      ('public.ensure_player_stats_row(uuid)'),
      ('public.recompute_player_stats_aggregates(uuid)')
    ) AS t(sig)
  LOOP
    IF has_function_privilege('anon', v_fn.sig, 'EXECUTE') THEN
      RAISE NOTICE 'INVENTORY FAIL: anon can EXECUTE %', v_fn.sig;
      v_bad := v_bad + 1;
    END IF;
  END LOOP;
  IF v_bad > 0 THEN
    PERFORM security_assert.fail(format('inventory: %s internal helpers still executable by anon', v_bad));
  END IF;
  PERFORM security_assert.pass('inventory: listed internal helpers not executable by anon');

  -- ── Seed objects as organizer (positive setup) ──────────────────────────────
  PERFORM security_assert.set_jwt(v_organizer);
  SET ROLE authenticated;

  INSERT INTO public.matches (
    title, start_at, city, place_defined, duration_target_games,
    visibility, creator_id, status
  ) VALUES (
    'Casual public', NOW() + interval '1 day', 'Madrid', true, 1,
    'public', v_organizer, 'planned'
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.matches (
    title, start_at, city, place_defined, duration_target_games,
    visibility, creator_id, status
  ) VALUES (
    'Private casual', NOW() + interval '2 days', 'Madrid', true, 1,
    'private', v_organizer, 'planned'
  )
  RETURNING id INTO v_private_match_id;

  PERFORM public.set_match_password(v_private_match_id, 'secret-pass');

  INSERT INTO public.tournaments (
    title, start_at, city, place_defined, duration_target_games,
    visibility, creator_id, status
  ) VALUES (
    'Org Cup', NOW() + interval '3 days', 'Madrid', true, 1,
    'public', v_organizer, 'registration'
  )
  RETURNING id INTO v_tournament_id;

  INSERT INTO public.tournaments (
    title, start_at, city, place_defined, duration_target_games,
    visibility, creator_id, status
  ) VALUES (
    'Other Cup', NOW() + interval '4 days', 'Madrid', true, 1,
    'public', v_organizer, 'registration'
  )
  RETURNING id INTO v_tournament_b_id;

  -- Pairs for bracket (organizer + text partners so pairs are complete)
  SELECT id INTO v_pair_id FROM public.add_tournament_pair(
    v_tournament_id, 'Pair One', v_organizer, NULL, NULL, 'Partner A'
  );
  -- Second pair needs another authenticated creator context for player assignment rules;
  -- use text-only slots via organizer (cannot assign other user ids).
  SELECT id INTO v_pair_b_id FROM public.add_tournament_pair(
    v_tournament_id, 'Pair Two', NULL, 'Text A', NULL, 'Text B'
  );

  INSERT INTO public.leagues (
    title, start_at, city, place_defined, duration_target_games,
    visibility, format, creator_id, status
  ) VALUES (
    'Org League', NOW() + interval '5 days', 'Madrid', true, 1,
    'public', 'single_round', v_organizer, 'registration'
  )
  RETURNING id INTO v_league_id;

  SELECT id INTO v_lp1 FROM public.add_league_pair(
    v_league_id, 'L1', NULL, 'Alice', NULL, 'Bob'
  );
  SELECT id INTO v_lp2 FROM public.add_league_pair(
    v_league_id, 'L2', NULL, 'Carol', NULL, 'Dave'
  );

  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- Participant row for attacker on casual match (for re-point attack)
  PERFORM security_assert.set_jwt(v_attacker);
  SET ROLE authenticated;
  INSERT INTO public.match_participants (match_id, user_id, team, state)
  VALUES (v_match_id, v_attacker, 'B', 'confirmed');
  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- ── Cross-object attacks as authenticated attacker ──────────────────────────
  PERFORM security_assert.set_jwt(v_attacker);
  SET ROLE authenticated;

  PERFORM security_assert.expect_blocked(
    'attacker rewrite match.tournament_id',
    format(
      'UPDATE public.matches SET tournament_id = %L::uuid WHERE id = %L::uuid',
      v_tournament_id, v_match_id
    )
  );

  PERFORM security_assert.expect_blocked(
    'attacker re-point match_participants.match_id',
    format(
      'UPDATE public.match_participants SET match_id = %L::uuid WHERE match_id = %L::uuid AND user_id = %L::uuid',
      v_private_match_id, v_match_id, v_attacker
    )
  );

  PERFORM security_assert.expect_blocked(
    'attacker fabricated tournament final insert',
    format(
      $sql$
      INSERT INTO public.matches (
        title, start_at, city, place_defined, duration_target_games,
        visibility, creator_id, status, tournament_id,
        tournament_round_size, tournament_bracket_position
      ) VALUES (
        'Fake Final', NOW(), 'Madrid', true, 1,
        'public', %L::uuid, 'planned', %L::uuid,
        2, 0
      )
      $sql$,
      v_attacker, v_tournament_id
    )
  );

  -- Pair owned by organizer; attacker tries to move it / flip entry_fee_paid
  PERFORM security_assert.expect_blocked(
    'attacker move tournament_pair to other tournament',
    format(
      'UPDATE public.tournament_pairs SET tournament_id = %L::uuid WHERE id = %L::uuid',
      v_tournament_b_id, v_pair_id
    )
  );

  PERFORM security_assert.expect_blocked(
    'attacker set entry_fee_paid',
    format(
      'UPDATE public.tournament_pairs SET entry_fee_paid = true WHERE id = %L::uuid',
      v_pair_id
    )
  );

  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- ── Positive controls ───────────────────────────────────────────────────────
  -- 1) Create standalone match
  PERFORM security_assert.set_jwt(v_organizer);
  SET ROLE authenticated;
  INSERT INTO public.matches (
    title, start_at, city, place_defined, duration_target_games,
    visibility, creator_id, status
  ) VALUES (
    'Standalone OK', NOW() + interval '6 days', 'Madrid', true, 1,
    'public', v_organizer, 'planned'
  );
  PERFORM security_assert.pass('positive: create standalone match');

  -- 2) Organizer generate_tournament_bracket
  PERFORM public.generate_tournament_bracket(v_tournament_id);
  PERFORM security_assert.pass('positive: organizer generate_tournament_bracket');

  -- 3) Edit own pair name (organizer is created_by / member of pair)
  UPDATE public.tournament_pairs
  SET name = 'Pair One Renamed', name_is_custom = true
  WHERE id = v_pair_id;
  IF NOT FOUND THEN
    PERFORM security_assert.fail('positive: edit own pair name — no row updated');
  END IF;
  PERFORM security_assert.pass('positive: edit own pair name');

  -- 4) generate_league_fixtures
  PERFORM public.generate_league_fixtures(v_league_id);
  PERFORM security_assert.pass('positive: generate_league_fixtures');

  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- 5) join_private_match with correct password
  PERFORM security_assert.set_jwt(v_joiner);
  SET ROLE authenticated;
  PERFORM public.join_private_match(v_private_match_id, 'B', 'secret-pass');
  PERFORM security_assert.pass('positive: join_private_match with correct password');
  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- 6) admin_set_user_status as admin
  PERFORM security_assert.set_jwt(v_admin);
  SET ROLE authenticated;
  PERFORM public.admin_set_user_status(v_victim, 'suspended');
  SELECT status INTO v_status FROM public.profiles WHERE id = v_victim;
  RESET ROLE;
  PERFORM security_assert.clear_jwt();

  -- Verify auth.users.banned_until as table owner (client roles cannot SELECT auth.users)
  SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_victim;
  IF v_status IS DISTINCT FROM 'suspended' THEN
    PERFORM security_assert.fail('positive: admin_set_user_status — profile status not suspended');
  END IF;
  IF v_banned IS NULL THEN
    PERFORM security_assert.fail('positive: admin_set_user_status — banned_until not set');
  END IF;
  PERFORM security_assert.pass('positive: admin_set_user_status as admin');

  -- Sentinel credential rotated (vuln-0001)
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = '00000000-0000-4000-8000-000000000001'::uuid
      AND encrypted_password <> ''
  ) THEN
    PERFORM security_assert.fail('sentinel encrypted_password was not cleared');
  END IF;
  PERFORM security_assert.pass('sentinel credential rotated');

  RAISE NOTICE 'ALL SECURITY ASSERTIONS PASSED';
END;
$$;
