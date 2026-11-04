-- =============================================================
-- NICESA Inter-Level 5-a-Side Football Tournament
-- Migration 001: Initial schema
-- =============================================================

-- Enable pgcrypto for UUID generation and pg_hashids for audit
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE student_level AS ENUM ('100', '200', '300', '400', '500');
CREATE TYPE eligibility_status AS ENUM ('eligible', 'ineligible', 'suspended');
CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'withdrawn');
CREATE TYPE tournament_phase AS ENUM ('setup', 'registration_open', 'registration_closed', 'draw_generated', 'draw_published', 'in_progress', 'completed');
CREATE TYPE fixture_status AS ENUM ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled');
CREATE TYPE draw_status AS ENUM ('draft', 'published', 'superseded');
CREATE TYPE audit_action AS ENUM (
  'registration_opened', 'registration_closed',
  'student_list_uploaded', 'student_registered',
  'draw_generated', 'draw_published', 'draw_superseded',
  'fixture_created', 'score_entered', 'score_updated',
  'admin_login', 'registration_withdrawn'
);

-- =============================================================
-- TOURNAMENT SETTINGS (single-row config table)
-- =============================================================

CREATE TABLE tournament_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- only one row
  name                 TEXT NOT NULL DEFAULT 'NICESA Inter-Level 5-a-Side Football Tournament',
  edition              TEXT NOT NULL DEFAULT '2026',
  phase                tournament_phase NOT NULL DEFAULT 'setup',
  squad_size           INTEGER NOT NULL DEFAULT 5 CHECK (squad_size BETWEEN 5 AND 11),
  substitute_slots     INTEGER NOT NULL DEFAULT 2 CHECK (substitute_slots >= 0),
  registration_message TEXT,
  announcement         TEXT,
  announcement_updated_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single settings row immediately
INSERT INTO tournament_settings (id) VALUES (1);

-- =============================================================
-- APPROVED STUDENT LIST
-- =============================================================

CREATE TABLE approved_students (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matric_number  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  level          student_level NOT NULL,
  eligibility    eligibility_status NOT NULL DEFAULT 'eligible',
  upload_batch   UUID NOT NULL,                 -- which CSV upload this came from
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT approved_students_matric_unique UNIQUE (matric_number)
);

-- Normalise matric numbers to uppercase on insert/update
CREATE OR REPLACE FUNCTION normalise_matric()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.matric_number := upper(trim(NEW.matric_number));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalise_matric_approved
  BEFORE INSERT OR UPDATE ON approved_students
  FOR EACH ROW EXECUTE FUNCTION normalise_matric();

-- Index for fast lookups by matric number
CREATE INDEX idx_approved_students_matric ON approved_students (matric_number);
CREATE INDEX idx_approved_students_level  ON approved_students (level);

-- =============================================================
-- REGISTRATIONS
-- =============================================================

CREATE TABLE registrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matric_number   TEXT NOT NULL,
  student_id      UUID NOT NULL REFERENCES approved_students(id),
  full_name       TEXT NOT NULL,      -- denormalised from approved_students at registration time
  level           student_level NOT NULL,
  status          registration_status NOT NULL DEFAULT 'confirmed',
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      INET,               -- for rate-limit auditing (hashed in application layer)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT registrations_matric_unique UNIQUE (matric_number)  -- one registration per student
);

CREATE TRIGGER trg_normalise_matric_reg
  BEFORE INSERT OR UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION normalise_matric();

CREATE INDEX idx_registrations_student   ON registrations (student_id);
CREATE INDEX idx_registrations_level     ON registrations (level);
CREATE INDEX idx_registrations_status    ON registrations (status);

-- =============================================================
-- RATE-LIMIT TRACKING (verification attempts)
-- =============================================================

CREATE TABLE verification_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_hash      TEXT NOT NULL,        -- SHA-256 of IP; never store raw IP in this table
  matric_hash  TEXT NOT NULL,        -- SHA-256 of matric number
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  succeeded    BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_verify_ip_hash ON verification_attempts (ip_hash, attempted_at);

-- Clean up attempts older than 24 hours (called by pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION cleanup_old_attempts()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM verification_attempts WHERE attempted_at < now() - INTERVAL '24 hours';
$$;

-- =============================================================
-- TEAMS & DRAW
-- =============================================================

CREATE TABLE draws (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status        draw_status NOT NULL DEFAULT 'draft',
  squad_size    INTEGER NOT NULL,
  total_teams   INTEGER NOT NULL,
  total_players INTEGER NOT NULL,
  unassigned    INTEGER NOT NULL DEFAULT 0,
  seed_value    TEXT NOT NULL,        -- random seed used; reproducibility
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  notes         TEXT,
  generated_by  UUID REFERENCES auth.users(id),
  published_by  UUID REFERENCES auth.users(id),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);

CREATE TABLE teams (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id    UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  team_name  TEXT NOT NULL,           -- e.g. "Team A", "Alpha Squad"
  team_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT teams_draw_number_unique UNIQUE (draw_id, team_number)
);

CREATE INDEX idx_teams_draw ON teams (draw_id);

CREATE TABLE team_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id),
  is_substitute   BOOLEAN NOT NULL DEFAULT false,
  slot_position   INTEGER NOT NULL,   -- 1-based position in squad
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT team_members_registration_unique UNIQUE (registration_id) -- one team per student
);

CREATE INDEX idx_team_members_team         ON team_members (team_id);
CREATE INDEX idx_team_members_registration ON team_members (registration_id);

-- Unassigned players from a draw (when teams cannot be completed)
CREATE TABLE unassigned_players (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id         UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id),
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- FIXTURES & STANDINGS
-- =============================================================

CREATE TABLE fixtures (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id      UUID NOT NULL REFERENCES draws(id),
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  round        INTEGER NOT NULL DEFAULT 1,
  match_number INTEGER NOT NULL,
  venue        TEXT,
  scheduled_at TIMESTAMPTZ,
  status       fixture_status NOT NULL DEFAULT 'scheduled',
  home_score   INTEGER CHECK (home_score >= 0),
  away_score   INTEGER CHECK (away_score >= 0),
  created_by   UUID REFERENCES auth.users(id),
  updated_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fixtures_no_self_play CHECK (home_team_id <> away_team_id)
);

CREATE INDEX idx_fixtures_draw      ON fixtures (draw_id);
CREATE INDEX idx_fixtures_home_team ON fixtures (home_team_id);
CREATE INDEX idx_fixtures_away_team ON fixtures (away_team_id);
CREATE INDEX idx_fixtures_round     ON fixtures (round);

-- Materialised standings view (refreshed after each score update)
CREATE TABLE standings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id     UUID NOT NULL REFERENCES draws(id),
  team_id     UUID NOT NULL REFERENCES teams(id),
  played      INTEGER NOT NULL DEFAULT 0,
  won         INTEGER NOT NULL DEFAULT 0,
  drawn       INTEGER NOT NULL DEFAULT 0,
  lost        INTEGER NOT NULL DEFAULT 0,
  goals_for   INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  points      INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT standings_draw_team_unique UNIQUE (draw_id, team_id)
);

CREATE INDEX idx_standings_draw   ON standings (draw_id, points DESC);

-- Recompute standings for all teams in a draw
CREATE OR REPLACE FUNCTION recompute_standings(p_draw_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_team RECORD;
  v_played INT; v_won INT; v_drawn INT; v_lost INT;
  v_gf INT; v_ga INT; v_pts INT;
BEGIN
  FOR v_team IN SELECT id FROM teams WHERE draw_id = p_draw_id LOOP
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'completed'
        AND ((home_team_id = v_team.id AND home_score > away_score)
          OR (away_team_id = v_team.id AND away_score > home_score))),
      COUNT(*) FILTER (WHERE status = 'completed'
        AND home_score = away_score),
      COUNT(*) FILTER (WHERE status = 'completed'
        AND ((home_team_id = v_team.id AND home_score < away_score)
          OR (away_team_id = v_team.id AND away_score < home_score))),
      COALESCE(SUM(CASE WHEN home_team_id = v_team.id THEN home_score
                        WHEN away_team_id = v_team.id THEN away_score ELSE 0 END)
               FILTER (WHERE status = 'completed'), 0),
      COALESCE(SUM(CASE WHEN home_team_id = v_team.id THEN away_score
                        WHEN away_team_id = v_team.id THEN home_score ELSE 0 END)
               FILTER (WHERE status = 'completed'), 0)
    INTO v_played, v_won, v_drawn, v_lost, v_gf, v_ga
    FROM fixtures
    WHERE draw_id = p_draw_id
      AND (home_team_id = v_team.id OR away_team_id = v_team.id);

    v_pts := v_won * 3 + v_drawn;

    INSERT INTO standings (draw_id, team_id, played, won, drawn, lost,
                           goals_for, goals_against, points)
    VALUES (p_draw_id, v_team.id, v_played, v_won, v_drawn, v_lost,
            v_gf, v_ga, v_pts)
    ON CONFLICT (draw_id, team_id) DO UPDATE SET
      played        = EXCLUDED.played,
      won           = EXCLUDED.won,
      drawn         = EXCLUDED.drawn,
      lost          = EXCLUDED.lost,
      goals_for     = EXCLUDED.goals_for,
      goals_against = EXCLUDED.goals_against,
      points        = EXCLUDED.points,
      updated_at    = now();
  END LOOP;
END;
$$;

-- Trigger standings recompute after fixture score update
CREATE OR REPLACE FUNCTION trg_recompute_standings_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' OR OLD.status = 'completed' THEN
    PERFORM recompute_standings(NEW.draw_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recompute_standings
  AFTER INSERT OR UPDATE ON fixtures
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_standings_fn();

-- =============================================================
-- AUDIT LOG
-- =============================================================

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action      audit_action NOT NULL,
  actor_id    UUID REFERENCES auth.users(id),
  actor_email TEXT,
  target_id   UUID,                  -- e.g. draw_id, registration_id
  target_type TEXT,                  -- e.g. 'draw', 'registration'
  payload     JSONB NOT NULL DEFAULT '{}',
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_action     ON audit_log (action);
CREATE INDEX idx_audit_actor      ON audit_log (actor_id);
CREATE INDEX idx_audit_created_at ON audit_log (created_at DESC);
CREATE INDEX idx_audit_target     ON audit_log (target_id);

-- =============================================================
-- ADMIN ROLES (stored in auth.users app_metadata by Supabase)
-- Helper function to check if the calling user is an admin
-- =============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- =============================================================
-- UPDATED_AT TRIGGER (reusable)
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tournament_settings_updated_at
  BEFORE UPDATE ON tournament_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_approved_students_updated_at
  BEFORE UPDATE ON approved_students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fixtures_updated_at
  BEFORE UPDATE ON fixtures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- SECURE REGISTRATION FUNCTION
-- Called by anonymous users via RPC; runs with SECURITY DEFINER
-- so it can read approved_students (which anon cannot).
-- =============================================================

CREATE OR REPLACE FUNCTION register_student(
  p_matric   TEXT,
  p_ip_hash  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matric        TEXT := upper(trim(p_matric));
  v_student       approved_students%ROWTYPE;
  v_reg           registrations%ROWTYPE;
  v_attempt_count INT;
  v_phase         tournament_phase;
  v_result        JSONB;
BEGIN
  -- 1. Check tournament phase
  SELECT phase INTO v_phase FROM tournament_settings WHERE id = 1;
  IF v_phase <> 'registration_open' THEN
    RETURN jsonb_build_object('success', false, 'code', 'REGISTRATION_CLOSED',
      'message', 'Registration is not currently open.');
  END IF;

  -- 2. Rate-limit: max 10 attempts per IP per hour
  IF p_ip_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO v_attempt_count
    FROM verification_attempts
    WHERE ip_hash = p_ip_hash
      AND attempted_at > now() - INTERVAL '1 hour';

    IF v_attempt_count >= 10 THEN
      RETURN jsonb_build_object('success', false, 'code', 'RATE_LIMITED',
        'message', 'Too many attempts. Please try again later.');
    END IF;
  END IF;

  -- 3. Record the attempt
  INSERT INTO verification_attempts (ip_hash, matric_hash, succeeded)
  VALUES (
    COALESCE(p_ip_hash, 'unknown'),
    encode(digest(v_matric, 'sha256'), 'hex'),
    false
  );

  -- 4. Validate matric format (basic: not empty, max 20 chars)
  IF length(v_matric) < 5 OR length(v_matric) > 20 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_MATRIC',
      'message', 'Invalid matric number format.');
  END IF;

  -- 5. Look up in approved list
  SELECT * INTO v_student FROM approved_students WHERE matric_number = v_matric;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_APPROVED',
      'message', 'This matric number is not on the approved student list.');
  END IF;

  -- 6. Check eligibility
  IF v_student.eligibility <> 'eligible' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ELIGIBLE',
      'message', 'You are not eligible to participate in this tournament.');
  END IF;

  -- 7. Check for existing registration
  SELECT * INTO v_reg FROM registrations WHERE matric_number = v_matric;
  IF FOUND THEN
    IF v_reg.status = 'confirmed' THEN
      RETURN jsonb_build_object('success', false, 'code', 'ALREADY_REGISTERED',
        'message', 'This matric number is already registered.',
        'registration_id', v_reg.id);
    END IF;
  END IF;

  -- 8. Create the registration
  INSERT INTO registrations (matric_number, student_id, full_name, level)
  VALUES (v_matric, v_student.id, v_student.full_name, v_student.level)
  RETURNING * INTO v_reg;

  -- 9. Update attempt record to succeeded
  UPDATE verification_attempts
  SET succeeded = true
  WHERE id = (
    SELECT id FROM verification_attempts
    WHERE ip_hash = COALESCE(p_ip_hash, 'unknown')
    ORDER BY attempted_at DESC LIMIT 1
  );

  -- 10. Audit log
  INSERT INTO audit_log (action, target_id, target_type, payload)
  VALUES ('student_registered', v_reg.id, 'registration',
    jsonb_build_object('matric', v_matric, 'level', v_student.level,
                       'name', v_student.full_name));

  RETURN jsonb_build_object(
    'success', true,
    'code', 'REGISTERED',
    'registration_id', v_reg.id,
    'full_name', v_reg.full_name,
    'level', v_reg.level,
    'registered_at', v_reg.registered_at
  );
END;
$$;

-- Revoke direct table access from anon for register_student's tables
-- (RLS policies below handle this properly)
REVOKE ALL ON approved_students FROM anon;
REVOKE ALL ON approved_students FROM authenticated;

-- Allow anon to call the RPC
GRANT EXECUTE ON FUNCTION register_student(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_student(TEXT, TEXT) TO authenticated;

-- =============================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================

-- tournament_settings: publicly readable, admin-only writes
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tournament settings"
  ON tournament_settings FOR SELECT USING (true);

CREATE POLICY "Admin write tournament settings"
  ON tournament_settings FOR ALL USING (is_admin());

-- approved_students: no direct public access (accessed via SECURITY DEFINER fn)
ALTER TABLE approved_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access approved_students"
  ON approved_students FOR ALL USING (is_admin());

-- registrations: public can read confirmed registrations (no PII beyond name/level);
-- admins have full access; students cannot write directly (only via RPC).
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read confirmed registrations"
  ON registrations FOR SELECT
  USING (status = 'confirmed');

CREATE POLICY "Admin full access registrations"
  ON registrations FOR ALL USING (is_admin());

-- draws: draft only visible to admins; published visible to all
ALTER TABLE draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published draws"
  ON draws FOR SELECT USING (status = 'published');

CREATE POLICY "Admin full access draws"
  ON draws FOR ALL USING (is_admin());

-- teams: only visible when the draw is published
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read teams of published draws"
  ON teams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM draws d WHERE d.id = teams.draw_id AND d.status = 'published')
  );

CREATE POLICY "Admin full access teams"
  ON teams FOR ALL USING (is_admin());

-- team_members: same rule as teams
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read members of published draws"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN draws d ON d.id = t.draw_id
      WHERE t.id = team_members.team_id AND d.status = 'published'
    )
  );

CREATE POLICY "Admin full access team_members"
  ON team_members FOR ALL USING (is_admin());

-- unassigned_players: admin only
ALTER TABLE unassigned_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access unassigned_players"
  ON unassigned_players FOR ALL USING (is_admin());

-- fixtures: public read
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fixtures"
  ON fixtures FOR SELECT USING (true);

CREATE POLICY "Admin full access fixtures"
  ON fixtures FOR ALL USING (is_admin());

-- standings: public read
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read standings"
  ON standings FOR SELECT USING (true);

CREATE POLICY "Admin full access standings"
  ON standings FOR ALL USING (is_admin());

-- audit_log: admin only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit_log"
  ON audit_log FOR SELECT USING (is_admin());

CREATE POLICY "System insert audit_log"
  ON audit_log FOR INSERT WITH CHECK (true);  -- inserts happen inside SECURITY DEFINER fns

-- verification_attempts: no direct external access
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access verification_attempts"
  ON verification_attempts FOR ALL USING (false);

-- =============================================================
-- VIEWS for public consumption (safe, no PII leakage)
-- =============================================================

-- Registration summary (count per level, no individual data)
CREATE OR REPLACE VIEW registration_summary AS
SELECT
  level,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_count
FROM registrations
GROUP BY level
ORDER BY level;

GRANT SELECT ON registration_summary TO anon, authenticated;

-- Public team roster view (only when draw is published)
CREATE OR REPLACE VIEW public_team_roster AS
SELECT
  t.id          AS team_id,
  t.team_name,
  t.team_number,
  d.id          AS draw_id,
  r.id          AS registration_id,
  r.full_name,
  r.level,
  r.matric_number,
  tm.is_substitute,
  tm.slot_position
FROM teams t
JOIN draws d ON d.id = t.draw_id AND d.status = 'published'
JOIN team_members tm ON tm.team_id = t.id
JOIN registrations r ON r.id = tm.registration_id
ORDER BY t.team_number, tm.slot_position;

GRANT SELECT ON public_team_roster TO anon, authenticated;

-- Student lookup: given a matric, return their team (only after draw published)
CREATE OR REPLACE FUNCTION get_my_team(p_matric TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matric TEXT := upper(trim(p_matric));
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'team_id',       t.id,
    'team_name',     t.team_name,
    'team_number',   t.team_number,
    'is_substitute', tm.is_substitute,
    'slot_position', tm.slot_position,
    'teammates', (
      SELECT jsonb_agg(jsonb_build_object(
        'full_name',     r2.full_name,
        'level',         r2.level,
        'is_substitute', tm2.is_substitute
      ) ORDER BY tm2.slot_position)
      FROM team_members tm2
      JOIN registrations r2 ON r2.id = tm2.registration_id
      WHERE tm2.team_id = t.id
    )
  ) INTO v_result
  FROM registrations r
  JOIN team_members tm ON tm.registration_id = r.id
  JOIN teams t ON t.id = tm.team_id
  JOIN draws d ON d.id = t.draw_id AND d.status = 'published'
  WHERE r.matric_number = v_matric AND r.status = 'confirmed';

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN v_result || jsonb_build_object('found', true);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_team(TEXT) TO anon, authenticated;
