-- ================================================================
-- NICESA Inter-Level 5-a-Side Football Tournament
-- SQLite / libSQL Schema (Turso-compatible)
-- Run via: node server/db/migrate.js
-- ================================================================

-- ----------------------------------------------------------------
-- tournament_settings  (single config row, id always = 1)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_settings (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  name                    TEXT    NOT NULL DEFAULT 'NICESA Inter-Level 5-a-Side Football Tournament',
  edition                 TEXT    NOT NULL DEFAULT '2026',
  phase                   TEXT    NOT NULL DEFAULT 'setup'
                          CHECK (phase IN (
                            'setup','registration_open','registration_closed',
                            'draw_generated','draw_published','in_progress','completed'
                          )),
  squad_size              INTEGER NOT NULL DEFAULT 5  CHECK (squad_size  BETWEEN 5 AND 11),
  substitute_slots        INTEGER NOT NULL DEFAULT 2  CHECK (substitute_slots >= 0),
  registration_message    TEXT,
  announcement            TEXT,
  announcement_updated_at TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed the single settings row (safe to re-run)
INSERT OR IGNORE INTO tournament_settings (id) VALUES (1);

-- ----------------------------------------------------------------
-- admin_users  (bcrypt-hashed passwords; no Supabase Auth)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------
-- approved_students
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approved_students (
  id             TEXT PRIMARY KEY,
  matric_number  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name      TEXT NOT NULL,
  level          TEXT NOT NULL CHECK (level IN ('100','200','300','400','500')),
  eligibility    TEXT NOT NULL DEFAULT 'eligible'
                 CHECK (eligibility IN ('eligible','ineligible','suspended')),
  upload_batch   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_approved_students_matric ON approved_students (matric_number COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_approved_students_level  ON approved_students (level);

-- ----------------------------------------------------------------
-- registrations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id              TEXT PRIMARY KEY,
  matric_number   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  student_id      TEXT NOT NULL REFERENCES approved_students(id),
  full_name       TEXT NOT NULL,
  level           TEXT NOT NULL CHECK (level IN ('100','200','300','400','500')),
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('pending','confirmed','withdrawn')),
  registered_at   TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash         TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_level  ON registrations (level);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations (status);

-- ----------------------------------------------------------------
-- verification_attempts  (rate limiting)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_attempts (
  id           TEXT PRIMARY KEY,
  ip_hash      TEXT NOT NULL,
  matric_hash  TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  succeeded    INTEGER NOT NULL DEFAULT 0  -- 0=false, 1=true
);

CREATE INDEX IF NOT EXISTS idx_verify_ip ON verification_attempts (ip_hash, attempted_at);

-- ----------------------------------------------------------------
-- draws
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draws (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','superseded')),
  squad_size        INTEGER NOT NULL,
  substitute_slots  INTEGER NOT NULL DEFAULT 0,
  total_teams       INTEGER NOT NULL,
  total_players     INTEGER NOT NULL,
  unassigned        INTEGER NOT NULL DEFAULT 0,
  seed_value        TEXT NOT NULL,
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  notes             TEXT,
  generated_by      TEXT REFERENCES admin_users(id),
  published_by      TEXT REFERENCES admin_users(id),
  generated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  published_at      TEXT
);

-- ----------------------------------------------------------------
-- teams
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  draw_id     TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  team_name   TEXT NOT NULL,
  team_number INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, team_number)
);

CREATE INDEX IF NOT EXISTS idx_teams_draw ON teams (draw_id);

-- ----------------------------------------------------------------
-- team_members
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id),
  is_substitute   INTEGER NOT NULL DEFAULT 0,  -- 0=false, 1=true
  slot_position   INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);

-- ----------------------------------------------------------------
-- unassigned_players
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unassigned_players (
  id              TEXT PRIMARY KEY,
  draw_id         TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES registrations(id),
  reason          TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------
-- fixtures
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixtures (
  id           TEXT PRIMARY KEY,
  draw_id      TEXT NOT NULL REFERENCES draws(id),
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  round        INTEGER NOT NULL DEFAULT 1,
  match_number INTEGER NOT NULL,
  venue        TEXT,
  scheduled_at TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled','in_progress','completed','postponed','cancelled')),
  home_score   INTEGER CHECK (home_score >= 0),
  away_score   INTEGER CHECK (away_score >= 0),
  created_by   TEXT REFERENCES admin_users(id),
  updated_by   TEXT REFERENCES admin_users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (home_team_id != away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_fixtures_draw ON fixtures (draw_id);

-- ----------------------------------------------------------------
-- standings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standings (
  id            TEXT PRIMARY KEY,
  draw_id       TEXT NOT NULL REFERENCES draws(id),
  team_id       TEXT NOT NULL REFERENCES teams(id),
  played        INTEGER NOT NULL DEFAULT 0,
  won           INTEGER NOT NULL DEFAULT 0,
  drawn         INTEGER NOT NULL DEFAULT 0,
  lost          INTEGER NOT NULL DEFAULT 0,
  goals_for     INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_draw ON standings (draw_id, points);

-- ----------------------------------------------------------------
-- audit_log
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  actor_id    TEXT REFERENCES admin_users(id),
  actor_email TEXT,
  target_id   TEXT,
  target_type TEXT,
  payload     TEXT NOT NULL DEFAULT '{}',  -- JSON stored as TEXT
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at);
