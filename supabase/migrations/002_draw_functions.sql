-- =============================================================
-- Migration 002: Team draw generation stored procedure
-- Called by the Edge Function; runs entirely in the database
-- as a single transaction to prevent partial saves.
-- =============================================================

CREATE OR REPLACE FUNCTION generate_team_draw(
  p_admin_id     UUID,
  p_squad_size   INTEGER DEFAULT NULL,    -- NULL = use tournament_settings value
  p_sub_slots    INTEGER DEFAULT NULL,
  p_seed         TEXT    DEFAULT NULL,    -- NULL = use random UUID as seed
  p_preview_only BOOLEAN DEFAULT true     -- true = dry run, false = persist
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_squad_size   INTEGER;
  v_sub_slots    INTEGER;
  v_total_size   INTEGER;  -- starting players + subs per team
  v_seed         TEXT;
  v_phase        tournament_phase;
  v_draw_id      UUID;

  -- Registration data
  v_registrations JSONB;
  v_levels        TEXT[] := ARRAY['100','200','300','400','500'];
  v_level         TEXT;
  v_level_players JSONB;
  v_all_players   JSONB  := '[]'::JSONB;
  v_shuffled      JSONB  := '[]'::JSONB;

  -- Team building
  v_total_players INTEGER;
  v_num_teams     INTEGER;
  v_teams         JSONB  := '[]'::JSONB;
  v_team          JSONB;
  v_member        JSONB;
  v_unassigned    JSONB  := '[]'::JSONB;
  v_slot          INTEGER;

  -- Round-robin distribution state
  v_buckets       JSONB  := '{}'::JSONB;  -- level -> array of player objects
  v_bucket_sizes  INTEGER[];
  v_team_idx      INTEGER;
  v_level_idx     INTEGER;
  v_player        JSONB;
  v_team_members_acc JSONB;
  v_picked        BOOLEAN;

  -- Validation
  v_validation    JSONB  := '[]'::JSONB;
  v_team_level_counts JSONB;

  i INTEGER; j INTEGER; k INTEGER;
  v_tmp JSONB; v_tmp2 JSONB;
  v_level_in_team TEXT[];
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Auth check
  -- ----------------------------------------------------------------
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED',
      'message', 'Only administrators can generate the draw.');
  END IF;

  -- ----------------------------------------------------------------
  -- 2. Load settings
  -- ----------------------------------------------------------------
  SELECT
    COALESCE(p_squad_size, squad_size),
    COALESCE(p_sub_slots, substitute_slots),
    phase
  INTO v_squad_size, v_sub_slots, v_phase
  FROM tournament_settings WHERE id = 1;

  IF v_phase NOT IN ('registration_closed', 'draw_generated') THEN
    RETURN jsonb_build_object('success', false, 'code', 'WRONG_PHASE',
      'message', 'Registration must be closed before generating a draw. Current phase: ' || v_phase);
  END IF;

  v_total_size := v_squad_size + v_sub_slots;
  v_seed := COALESCE(p_seed, gen_random_uuid()::TEXT);

  -- ----------------------------------------------------------------
  -- 3. Load confirmed registrations, shuffle per level using seed
  -- ----------------------------------------------------------------
  FOR i IN 1..5 LOOP
    v_level := v_levels[i];

    SELECT jsonb_agg(
      jsonb_build_object(
        'registration_id', r.id,
        'matric_number',   r.matric_number,
        'full_name',       r.full_name,
        'level',           r.level
      )
      ORDER BY md5(r.id::TEXT || v_seed)  -- deterministic shuffle using seed
    ) INTO v_level_players
    FROM registrations r
    WHERE r.level::TEXT = v_level AND r.status = 'confirmed';

    IF v_level_players IS NOT NULL THEN
      v_buckets := jsonb_set(v_buckets, ARRAY[v_level], v_level_players);
      v_all_players := v_all_players || v_level_players;
    ELSE
      v_buckets := jsonb_set(v_buckets, ARRAY[v_level], '[]'::JSONB);
    END IF;
  END LOOP;

  v_total_players := jsonb_array_length(v_all_players);

  IF v_total_players = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_PLAYERS',
      'message', 'No confirmed registrations found.');
  END IF;

  -- ----------------------------------------------------------------
  -- 4. Calculate number of complete teams
  -- ----------------------------------------------------------------
  v_num_teams := v_total_players / v_total_size;

  IF v_num_teams = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'TOO_FEW_PLAYERS',
      'message', format('Need at least %s players for one team of %s. Currently have %s.',
                        v_total_size, v_total_size, v_total_players));
  END IF;

  -- ----------------------------------------------------------------
  -- 5. Round-robin distribution: fill teams one slot at a time,
  --    cycling through levels to maximise diversity.
  --    Algorithm:
  --    - For each slot in each team, pick the next available player
  --      from the most-populated remaining level that is not yet
  --      represented in this team (prefer diversity).
  --    - If all levels already represented, pick from most-populated.
  -- ----------------------------------------------------------------

  -- Initialise team accumulators
  FOR i IN 1..v_num_teams LOOP
    v_teams := v_teams || jsonb_build_array(
      jsonb_build_object('team_number', i, 'members', '[]'::JSONB)
    );
  END LOOP;

  -- Fill each slot across all teams
  FOR v_slot IN 1..v_total_size LOOP
    FOR v_team_idx IN 0..(v_num_teams - 1) LOOP
      -- Get current team's already-assigned levels
      v_team := v_teams -> v_team_idx;
      v_team_members_acc := v_team -> 'members';
      v_level_in_team := ARRAY(
        SELECT (m->>'level') FROM jsonb_array_elements(v_team_members_acc) AS m
      );

      v_picked := false;

      -- Try to pick from a level not yet in this team (sorted by bucket size desc)
      FOR v_level_idx IN 1..5 LOOP
        v_level := v_levels[v_level_idx];
        IF v_level = ANY(v_level_in_team) THEN CONTINUE; END IF;
        IF jsonb_array_length(v_buckets -> v_level) = 0 THEN CONTINUE; END IF;

        -- Pick first player from this level bucket
        v_player := v_buckets -> v_level -> 0;
        v_buckets := jsonb_set(v_buckets, ARRAY[v_level],
          (v_buckets -> v_level) - 0);

        v_member := v_player || jsonb_build_object(
          'is_substitute', v_slot > v_squad_size,
          'slot_position', v_slot
        );
        v_teams := jsonb_set(v_teams, ARRAY[v_team_idx::TEXT, 'members'],
          v_team_members_acc || jsonb_build_array(v_member));
        v_picked := true;
        EXIT;
      END LOOP;

      -- If still not picked (all levels already in team), take from largest bucket
      IF NOT v_picked THEN
        FOR v_level_idx IN 1..5 LOOP
          v_level := v_levels[v_level_idx];
          IF jsonb_array_length(v_buckets -> v_level) = 0 THEN CONTINUE; END IF;

          v_player := v_buckets -> v_level -> 0;
          v_buckets := jsonb_set(v_buckets, ARRAY[v_level],
            (v_buckets -> v_level) - 0);

          -- Refresh team_members_acc after possible earlier update in this slot pass
          v_team_members_acc := v_teams -> v_team_idx -> 'members';
          v_member := v_player || jsonb_build_object(
            'is_substitute', v_slot > v_squad_size,
            'slot_position', v_slot
          );
          v_teams := jsonb_set(v_teams, ARRAY[v_team_idx::TEXT, 'members'],
            v_team_members_acc || jsonb_build_array(v_member));
          v_picked := true;
          EXIT;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- ----------------------------------------------------------------
  -- 6. Collect unassigned players (remainder who didn't fit)
  -- ----------------------------------------------------------------
  FOR v_level_idx IN 1..5 LOOP
    v_level := v_levels[v_level_idx];
    FOR i IN 0..(jsonb_array_length(v_buckets -> v_level) - 1) LOOP
      v_player := v_buckets -> v_level -> i;
      v_unassigned := v_unassigned || jsonb_build_array(
        v_player || jsonb_build_object(
          'reason',
          format('Insufficient players to form a complete team of %s. %s players were unassigned.',
                 v_total_size,
                 v_total_players - (v_num_teams * v_total_size))
        )
      );
    END LOOP;
  END LOOP;

  -- ----------------------------------------------------------------
  -- 7. Validate: every confirmed registration must be accounted for
  -- ----------------------------------------------------------------
  DECLARE
    v_assigned_ids UUID[];
    v_unassigned_ids UUID[];
    v_all_reg_ids UUID[];
  BEGIN
    -- Collect assigned IDs
    FOR v_team_idx IN 0..(v_num_teams - 1) LOOP
      FOR i IN 0..(jsonb_array_length(v_teams -> v_team_idx -> 'members') - 1) LOOP
        v_assigned_ids := array_append(v_assigned_ids,
          (v_teams -> v_team_idx -> 'members' -> i ->> 'registration_id')::UUID);
      END LOOP;
    END LOOP;

    -- Collect unassigned IDs
    FOR i IN 0..(jsonb_array_length(v_unassigned) - 1) LOOP
      v_unassigned_ids := array_append(v_unassigned_ids,
        (v_unassigned -> i ->> 'registration_id')::UUID);
    END LOOP;

    -- All confirmed registrations
    SELECT array_agg(id) INTO v_all_reg_ids
    FROM registrations WHERE status = 'confirmed';

    -- Check for any missing
    IF v_all_reg_ids IS NOT NULL THEN
      FOR i IN 1..array_length(v_all_reg_ids, 1) LOOP
        IF NOT (v_all_reg_ids[i] = ANY(v_assigned_ids))
           AND NOT (v_all_reg_ids[i] = ANY(v_unassigned_ids)) THEN
          v_validation := v_validation || jsonb_build_array(
            jsonb_build_object('issue', 'MISSING_PLAYER',
              'registration_id', v_all_reg_ids[i])
          );
        END IF;
      END LOOP;
    END IF;
  END;

  -- ----------------------------------------------------------------
  -- 8. If preview_only, return without persisting
  -- ----------------------------------------------------------------
  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'success',         true,
      'preview',         true,
      'seed',            v_seed,
      'squad_size',      v_squad_size,
      'substitute_slots', v_sub_slots,
      'total_teams',     v_num_teams,
      'total_players',   v_total_players,
      'unassigned_count', jsonb_array_length(v_unassigned),
      'unassigned',      v_unassigned,
      'teams',           v_teams,
      'validation',      v_validation
    );
  END IF;

  -- ----------------------------------------------------------------
  -- 9. Persist the draw (single transaction)
  -- ----------------------------------------------------------------
  -- Mark any existing draft draws as superseded
  UPDATE draws SET status = 'superseded'
  WHERE status = 'draft';

  -- Insert draw record
  INSERT INTO draws (
    status, squad_size, total_teams, total_players,
    unassigned, seed_value, generated_by
  ) VALUES (
    'draft', v_squad_size, v_num_teams, v_total_players,
    jsonb_array_length(v_unassigned), v_seed, p_admin_id
  ) RETURNING id INTO v_draw_id;

  -- Insert teams and members
  FOR v_team_idx IN 0..(v_num_teams - 1) LOOP
    v_team := v_teams -> v_team_idx;
    DECLARE v_team_id UUID; BEGIN
      INSERT INTO teams (draw_id, team_name, team_number)
      VALUES (
        v_draw_id,
        'Team ' || chr(64 + (v_team ->> 'team_number')::INTEGER),  -- A, B, C...
        (v_team ->> 'team_number')::INTEGER
      ) RETURNING id INTO v_team_id;

      FOR i IN 0..(jsonb_array_length(v_team -> 'members') - 1) LOOP
        v_member := v_team -> 'members' -> i;
        INSERT INTO team_members (
          team_id, registration_id, is_substitute, slot_position
        ) VALUES (
          v_team_id,
          (v_member ->> 'registration_id')::UUID,
          (v_member ->> 'is_substitute')::BOOLEAN,
          (v_member ->> 'slot_position')::INTEGER
        );
      END LOOP;
    END;
  END LOOP;

  -- Insert unassigned records
  FOR i IN 0..(jsonb_array_length(v_unassigned) - 1) LOOP
    INSERT INTO unassigned_players (draw_id, registration_id, reason)
    VALUES (
      v_draw_id,
      (v_unassigned -> i ->> 'registration_id')::UUID,
      v_unassigned -> i ->> 'reason'
    );
  END LOOP;

  -- Update phase
  UPDATE tournament_settings SET phase = 'draw_generated' WHERE id = 1;

  -- Audit
  INSERT INTO audit_log (action, actor_id, target_id, target_type, payload)
  VALUES ('draw_generated', p_admin_id, v_draw_id, 'draw',
    jsonb_build_object('teams', v_num_teams, 'players', v_total_players,
                       'unassigned', jsonb_array_length(v_unassigned),
                       'seed', v_seed));

  RETURN jsonb_build_object(
    'success',          true,
    'preview',          false,
    'draw_id',          v_draw_id,
    'seed',             v_seed,
    'total_teams',      v_num_teams,
    'total_players',    v_total_players,
    'unassigned_count', jsonb_array_length(v_unassigned),
    'unassigned',       v_unassigned,
    'validation',       v_validation
  );
END;
$$;

GRANT EXECUTE ON FUNCTION generate_team_draw(UUID, INTEGER, INTEGER, TEXT, BOOLEAN)
  TO authenticated;

-- =============================================================
-- PUBLISH DRAW
-- =============================================================

CREATE OR REPLACE FUNCTION publish_draw(
  p_admin_id UUID,
  p_draw_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw draws%ROWTYPE;
  v_validation JSONB := '[]'::JSONB;
  v_team_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_draw FROM draws WHERE id = p_draw_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'DRAW_NOT_FOUND');
  END IF;

  IF v_draw.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'code', 'DRAW_NOT_DRAFT',
      'message', 'Only draft draws can be published. Current status: ' || v_draw.status);
  END IF;

  -- Validate at least one team exists
  SELECT COUNT(*) INTO v_team_count FROM teams WHERE draw_id = p_draw_id;
  IF v_team_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_TEAMS',
      'message', 'Cannot publish an empty draw.');
  END IF;

  -- Publish
  UPDATE draws
  SET status = 'published', published_by = p_admin_id, published_at = now()
  WHERE id = p_draw_id;

  UPDATE tournament_settings SET phase = 'draw_published' WHERE id = 1;

  -- Audit
  INSERT INTO audit_log (action, actor_id, target_id, target_type, payload)
  VALUES ('draw_published', p_admin_id, p_draw_id, 'draw',
    jsonb_build_object('teams', v_team_count));

  RETURN jsonb_build_object('success', true, 'draw_id', p_draw_id,
    'published_at', now(), 'teams_published', v_team_count);
END;
$$;

GRANT EXECUTE ON FUNCTION publish_draw(UUID, UUID) TO authenticated;
