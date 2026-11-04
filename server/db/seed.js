/**
 * Development seed data.
 * Run: node server/db/seed.js
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
try {
  const lines = readFileSync(join(__dirname, '../../.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
} catch { console.warn('⚠️  .env.local not found.') }

const { db } = await import('./client.js')

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

console.log('🌱  Seeding Turso database…\n')

// ── Reset tables ───────────────────────────────────────────────────
const resetTables = [
  'DELETE FROM audit_log',
  'DELETE FROM team_members',
  'DELETE FROM unassigned_players',
  'DELETE FROM teams',
  'DELETE FROM draws',
  'DELETE FROM fixtures',
  'DELETE FROM standings',
  'DELETE FROM registrations',
  'DELETE FROM approved_students',
  'DELETE FROM verification_attempts',
  'DELETE FROM admin_users',
  "UPDATE tournament_settings SET phase='registration_open', announcement='Welcome to the 2026 NICESA Inter-Level 5-a-Side Tournament! Registration is now open.' WHERE id=1",
]

for (const sql of resetTables) {
  await db.execute(sql)
}
console.log('🗑️   Tables cleared.')

// ── Admin user ─────────────────────────────────────────────────────
const adminPassword = 'Admin@2026!'
const adminHash     = await bcrypt.hash(adminPassword, 12)
const adminId       = uuid()

await db.execute({
  sql:  `INSERT INTO admin_users (id, email, password_hash) VALUES (?, ?, ?)`,
  args: [adminId, 'admin@nicesa.edu', adminHash],
})
console.log(`👤  Admin created:  admin@nicesa.edu  /  ${adminPassword}`)

// ── Approved students ──────────────────────────────────────────────
const students = [
  { matric: 'CVE/2024/001', name: 'Amara Okonkwo',       level: '100', eligibility: 'eligible'   },
  { matric: 'CVE/2024/002', name: 'Chukwuemeka Adeyemi', level: '100', eligibility: 'eligible'   },
  { matric: 'CVE/2024/003', name: 'Fatima Bello',        level: '100', eligibility: 'eligible'   },
  { matric: 'CVE/2024/004', name: 'Ibrahim Musa',        level: '100', eligibility: 'eligible'   },
  { matric: 'CVE/2024/005', name: 'Ngozi Eze',           level: '100', eligibility: 'eligible'   },
  { matric: 'CVE/2024/006', name: 'Taiwo Akinwale',      level: '100', eligibility: 'ineligible' },
  { matric: 'CVE/2023/001', name: 'Adaeze Nwosu',        level: '200', eligibility: 'eligible'   },
  { matric: 'CVE/2023/002', name: 'Babatunde Olawale',   level: '200', eligibility: 'eligible'   },
  { matric: 'CVE/2023/003', name: 'Chioma Obi',          level: '200', eligibility: 'eligible'   },
  { matric: 'CVE/2023/004', name: 'David Uche',          level: '200', eligibility: 'eligible'   },
  { matric: 'CVE/2023/005', name: 'Emeka Nwofor',        level: '200', eligibility: 'eligible'   },
  { matric: 'CVE/2022/001', name: 'Funmilayo Adeola',    level: '300', eligibility: 'eligible'   },
  { matric: 'CVE/2022/002', name: 'Gbenga Lawal',        level: '300', eligibility: 'eligible'   },
  { matric: 'CVE/2022/003', name: 'Hauwa Bala',          level: '300', eligibility: 'eligible'   },
  { matric: 'CVE/2022/004', name: 'Ifeanyi Okeke',       level: '300', eligibility: 'eligible'   },
  { matric: 'CVE/2022/005', name: 'Jumoke Salami',       level: '300', eligibility: 'eligible'   },
  { matric: 'CVE/2021/001', name: 'Kemi Adewale',        level: '400', eligibility: 'eligible'   },
  { matric: 'CVE/2021/002', name: 'Lanre Balogun',       level: '400', eligibility: 'eligible'   },
  { matric: 'CVE/2021/003', name: 'Miriam Duru',         level: '400', eligibility: 'eligible'   },
  { matric: 'CVE/2021/004', name: 'Nnamdi Okafor',       level: '400', eligibility: 'eligible'   },
  { matric: 'CVE/2021/005', name: 'Olumide Fashola',     level: '400', eligibility: 'eligible'   },
  { matric: 'CVE/2020/001', name: 'Patience Okonkwo',    level: '500', eligibility: 'eligible'   },
  { matric: 'CVE/2020/002', name: 'Quadri Yusuf',        level: '500', eligibility: 'eligible'   },
  { matric: 'CVE/2020/003', name: 'Rashida Abdullahi',   level: '500', eligibility: 'eligible'   },
  { matric: 'CVE/2020/004', name: 'Seun Olawuwo',        level: '500', eligibility: 'eligible'   },
  { matric: 'CVE/2020/005', name: 'Tunde Coker',         level: '500', eligibility: 'eligible'   },
]

const batchId = '00000000-0000-4000-a000-000000000001'
for (const s of students) {
  await db.execute({
    sql:  `INSERT INTO approved_students (id, matric_number, full_name, level, eligibility, upload_batch) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [uuid(), s.matric.toUpperCase(), s.name, s.level, s.eligibility, batchId],
  })
}
console.log(`📋  ${students.length} approved students inserted.`)

// ── Register all eligible students ────────────────────────────────
const eligibleRes = await db.execute(`SELECT * FROM approved_students WHERE eligibility = 'eligible'`)
for (const s of eligibleRes.rows) {
  await db.execute({
    sql:  `INSERT INTO registrations (id, matric_number, student_id, full_name, level) VALUES (?, ?, ?, ?, ?)`,
    args: [uuid(), s.matric_number, s.id, s.full_name, s.level],
  })
}
console.log(`✅  ${eligibleRes.rows.length} students registered.`)

console.log('\n🎉  Seed complete!')
console.log('──────────────────────────────────')
console.log('   Admin:    admin@nicesa.edu')
console.log(`   Password: ${adminPassword}`)
console.log('──────────────────────────────────')
console.log('   Now run:  npm run dev\n')
process.exit(0)
