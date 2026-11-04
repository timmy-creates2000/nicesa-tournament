-- =============================================================
-- NICESA Tournament — Development Seed Data
-- Run after all migrations: supabase db reset (resets + applies
-- migrations + runs this file automatically)
-- =============================================================

-- Ensure we start fresh in development
TRUNCATE TABLE
  audit_log, team_members, unassigned_players, teams, draws,
  fixtures, standings, registrations, approved_students,
  verification_attempts
RESTART IDENTITY CASCADE;

-- Reset tournament settings
UPDATE tournament_settings SET
  phase                = 'registration_open',
  squad_size           = 5,
  substitute_slots     = 2,
  announcement         = 'Welcome to the 2026 NICESA Inter-Level 5-a-Side Tournament! Registration is now open.',
  announcement_updated_at = now()
WHERE id = 1;

-- =============================================================
-- APPROVED STUDENTS (25 students — 5 per level)
-- Batch ID is a fixed UUID for reproducibility in tests
-- =============================================================

DO $$
DECLARE
  v_batch UUID := '00000000-0000-4000-a000-000000000001';
BEGIN
  INSERT INTO approved_students (matric_number, full_name, level, eligibility, upload_batch) VALUES
    -- 100 Level
    ('CVE/2024/001', 'Amara Okonkwo',       '100', 'eligible',   v_batch),
    ('CVE/2024/002', 'Chukwuemeka Adeyemi', '100', 'eligible',   v_batch),
    ('CVE/2024/003', 'Fatima Bello',         '100', 'eligible',   v_batch),
    ('CVE/2024/004', 'Ibrahim Musa',         '100', 'eligible',   v_batch),
    ('CVE/2024/005', 'Ngozi Eze',            '100', 'eligible',   v_batch),
    ('CVE/2024/006', 'Taiwo Akinwale',       '100', 'ineligible', v_batch),  -- ineligible test case

    -- 200 Level
    ('CVE/2023/001', 'Adaeze Nwosu',         '200', 'eligible',   v_batch),
    ('CVE/2023/002', 'Babatunde Olawale',    '200', 'eligible',   v_batch),
    ('CVE/2023/003', 'Chioma Obi',           '200', 'eligible',   v_batch),
    ('CVE/2023/004', 'David Uche',           '200', 'eligible',   v_batch),
    ('CVE/2023/005', 'Emeka Nwofor',         '200', 'eligible',   v_batch),

    -- 300 Level
    ('CVE/2022/001', 'Funmilayo Adeola',     '300', 'eligible',   v_batch),
    ('CVE/2022/002', 'Gbenga Lawal',         '300', 'eligible',   v_batch),
    ('CVE/2022/003', 'Hauwa Bala',           '300', 'eligible',   v_batch),
    ('CVE/2022/004', 'Ifeanyi Okeke',        '300', 'eligible',   v_batch),
    ('CVE/2022/005', 'Jumoke Salami',        '300', 'eligible',   v_batch),

    -- 400 Level
    ('CVE/2021/001', 'Kemi Adewale',         '400', 'eligible',   v_batch),
    ('CVE/2021/002', 'Lanre Balogun',        '400', 'eligible',   v_batch),
    ('CVE/2021/003', 'Miriam Duru',          '400', 'eligible',   v_batch),
    ('CVE/2021/004', 'Nnamdi Okafor',        '400', 'eligible',   v_batch),
    ('CVE/2021/005', 'Olumide Fashola',      '400', 'eligible',   v_batch),

    -- 500 Level
    ('CVE/2020/001', 'Patience Okonkwo',     '500', 'eligible',   v_batch),
    ('CVE/2020/002', 'Quadri Yusuf',         '500', 'eligible',   v_batch),
    ('CVE/2020/003', 'Rashida Abdullahi',    '500', 'eligible',   v_batch),
    ('CVE/2020/004', 'Seun Olawuwo',         '500', 'eligible',   v_batch),
    ('CVE/2020/005', 'Tunde Coker',          '500', 'eligible',   v_batch)
  ON CONFLICT (matric_number) DO UPDATE SET
    full_name   = EXCLUDED.full_name,
    level       = EXCLUDED.level,
    eligibility = EXCLUDED.eligibility,
    upload_batch = EXCLUDED.upload_batch;
END;
$$;

-- =============================================================
-- REGISTRATIONS (register all eligible students)
-- =============================================================

DO $$
DECLARE
  v_student approved_students%ROWTYPE;
BEGIN
  FOR v_student IN
    SELECT * FROM approved_students WHERE eligibility = 'eligible'
  LOOP
    BEGIN
      INSERT INTO registrations (matric_number, student_id, full_name, level)
      VALUES (v_student.matric_number, v_student.id, v_student.full_name, v_student.level)
      ON CONFLICT (matric_number) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Skip duplicates silently
    END;
  END LOOP;
END;
$$;

-- Log the seed registrations in audit log
INSERT INTO audit_log (action, target_type, payload)
VALUES ('student_list_uploaded', 'approved_students',
  '{"source": "seed", "count": 25, "batch": "00000000-0000-4000-a000-000000000001"}'::JSONB);

-- =============================================================
-- Note: To generate the draw and fixtures in development,
-- use the admin UI after seeding, or run the following steps:
--
--   1. supabase db reset      (applies migrations + seed)
--   2. Start the dev server:  npm run dev
--   3. Log in as admin at /admin/login
--   4. Go to Settings → set phase to 'registration_closed'
--   5. Go to Team Draw → Generate + Publish
--   6. Go to Fixtures → Create fixtures manually
-- =============================================================
