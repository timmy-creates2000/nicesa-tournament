import { Hono } from 'hono'
import { db } from '../db/client.js'
import { audit } from '../lib/audit.js'
import { uuid, sha256 } from '../lib/id.js'

const router = new Hono()

const RATE_LIMIT = 10 // max attempts per IP per hour

// POST /register
router.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const rawMatric = body.matric_number ?? ''

  const matric  = rawMatric.trim().toUpperCase()
  const ip      = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipHash  = sha256(ip + ':nicesa-salt')
  const matricHash = sha256(matric)

  // 1. Check tournament phase
  const settings = await db.execute(`SELECT phase FROM tournament_settings WHERE id = 1`)
  const phase    = settings.rows[0]?.phase
  if (phase !== 'registration_open') {
    return c.json({ success: false, code: 'REGISTRATION_CLOSED',
      message: 'Registration is not currently open.' })
  }

  // 2. Validate matric format
  if (matric.length < 5 || matric.length > 20) {
    return c.json({ success: false, code: 'INVALID_MATRIC',
      message: 'Invalid matric number format.' })
  }

  // 3. Rate limiting — max 10 attempts per IP per hour
  const attempts = await db.execute({
    sql:  `SELECT COUNT(*) as cnt FROM verification_attempts
           WHERE ip_hash = ? AND attempted_at > datetime('now', '-1 hour')`,
    args: [ipHash],
  })
  if (Number(attempts.rows[0]?.cnt ?? 0) >= RATE_LIMIT) {
    return c.json({ success: false, code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again later.' })
  }

  // 4. Record the attempt
  await db.execute({
    sql:  `INSERT INTO verification_attempts (id, ip_hash, matric_hash) VALUES (?, ?, ?)`,
    args: [uuid(), ipHash, matricHash],
  })

  // 5. Look up in approved list
  const studentRes = await db.execute({
    sql:  `SELECT * FROM approved_students WHERE matric_number = ? COLLATE NOCASE`,
    args: [matric],
  })
  const student = studentRes.rows[0]

  if (!student) {
    return c.json({ success: false, code: 'NOT_APPROVED',
      message: 'This matric number is not on the approved student list.' })
  }

  // 6. Check eligibility
  if (student.eligibility !== 'eligible') {
    return c.json({ success: false, code: 'NOT_ELIGIBLE',
      message: 'You are not eligible to participate in this tournament.' })
  }

  // 7. Check for existing registration
  const existing = await db.execute({
    sql:  `SELECT id, status FROM registrations WHERE matric_number = ? COLLATE NOCASE`,
    args: [matric],
  })
  const reg = existing.rows[0]

  if (reg?.status === 'confirmed') {
    return c.json({ success: false, code: 'ALREADY_REGISTERED',
      message: 'This matric number is already registered.',
      registration_id: reg.id })
  }

  // 8. Create registration
  const regId = uuid()
  await db.execute({
    sql:  `INSERT INTO registrations (id, matric_number, student_id, full_name, level, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
    args: [regId, matric, student.id, student.full_name, student.level, ipHash],
  })

  // 9. Audit
  await audit('student_registered', {
    targetId:   regId,
    targetType: 'registration',
    payload:    { matric, level: student.level, name: student.full_name },
    ipHash,
  })

  return c.json({
    success:         true,
    code:            'REGISTERED',
    registration_id: regId,
    full_name:       student.full_name,
    level:           student.level,
    registered_at:   new Date().toISOString(),
  })
})

// GET /register/my-team?matric=CVE/2024/001
router.get('/my-team', async (c) => {
  const matric = (c.req.query('matric') ?? '').trim().toUpperCase()
  if (!matric) return c.json({ found: false })

  // Only return team data if draw is published
  const settings = await db.execute(`SELECT phase FROM tournament_settings WHERE id = 1`)
  const phase    = settings.rows[0]?.phase
  const published = ['draw_published', 'in_progress', 'completed'].includes(phase)
  if (!published) return c.json({ found: false, reason: 'DRAW_NOT_PUBLISHED' })

  const regRes = await db.execute({
    sql:  `SELECT r.id, r.full_name, r.level FROM registrations r
           WHERE r.matric_number = ? COLLATE NOCASE AND r.status = 'confirmed'`,
    args: [matric],
  })
  const reg = regRes.rows[0]
  if (!reg) return c.json({ found: false })

  const memberRes = await db.execute({
    sql: `SELECT tm.is_substitute, tm.slot_position,
                 t.id as team_id, t.team_name, t.team_number,
                 d.id as draw_id
          FROM team_members tm
          JOIN teams t ON t.id = tm.team_id
          JOIN draws d ON d.id = t.draw_id AND d.status = 'published'
          WHERE tm.registration_id = ?`,
    args: [reg.id],
  })
  const member = memberRes.rows[0]
  if (!member) return c.json({ found: false })

  // Fetch all teammates
  const teammatesRes = await db.execute({
    sql: `SELECT r2.full_name, r2.level, tm2.is_substitute, tm2.slot_position
          FROM team_members tm2
          JOIN registrations r2 ON r2.id = tm2.registration_id
          WHERE tm2.team_id = ?
          ORDER BY tm2.slot_position`,
    args: [member.team_id],
  })

  return c.json({
    found:         true,
    team_id:       member.team_id,
    team_name:     member.team_name,
    team_number:   member.team_number,
    is_substitute: Boolean(member.is_substitute),
    slot_position: member.slot_position,
    teammates:     teammatesRes.rows.map(t => ({
      full_name:    t.full_name,
      level:        t.level,
      is_substitute: Boolean(t.is_substitute),
    })),
  })
})

export default router
