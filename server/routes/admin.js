import { Hono } from 'hono'
import { db } from '../db/client.js'
import { requireAdmin } from '../middleware/auth.js'
import { audit } from '../lib/audit.js'
import { uuid, randomSeed } from '../lib/id.js'
import { recomputeStandings } from '../lib/standings.js'

const router = new Hono()

// All admin routes require a valid JWT
router.use('/*', requireAdmin)

// ----------------------------------------------------------------
// Settings
// ----------------------------------------------------------------

// GET /admin/settings
router.get('/settings', async (c) => {
  const res = await db.execute(`SELECT * FROM tournament_settings WHERE id = 1`)
  return c.json(res.rows[0])
})

// PATCH /admin/settings
router.patch('/settings', async (c) => {
  const admin = c.get('admin')
  const body  = await c.req.json()
  const allowed = ['phase', 'announcement', 'squad_size', 'substitute_slots', 'registration_message']
  const updates = []
  const args    = []

  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`)
      args.push(body[key])
    }
  }
  if (updates.length === 0) return c.json({ error: 'No valid fields to update.' }, 400)

  updates.push(`updated_at = datetime('now')`)
  if ('announcement' in body) updates.push(`announcement_updated_at = datetime('now')`)

  args.push(1)
  await db.execute({ sql: `UPDATE tournament_settings SET ${updates.join(', ')} WHERE id = ?`, args })

  if ('phase' in body) {
    const action = body.phase === 'registration_open' ? 'registration_opened' : 'registration_closed'
    await audit(action, { actorId: admin.id, actorEmail: admin.email,
      payload: { phase: body.phase } })
  }

  const res = await db.execute(`SELECT * FROM tournament_settings WHERE id = 1`)
  return c.json(res.rows[0])
})

// ----------------------------------------------------------------
// Students (approved list)
// ----------------------------------------------------------------

// GET /admin/students
router.get('/students', async (c) => {
  const level  = c.req.query('level')
  const search = c.req.query('search')
  let sql  = `SELECT id, matric_number, full_name, level, eligibility, created_at FROM approved_students WHERE 1=1`
  const args = []
  if (level)  { sql += ` AND level = ?`;                                        args.push(level) }
  if (search) { sql += ` AND (matric_number LIKE ? OR full_name LIKE ?)`;
                args.push(`%${search}%`, `%${search}%`) }
  sql += ` ORDER BY level, full_name LIMIT 200`
  const res = await db.execute({ sql, args })
  return c.json(res.rows)
})

// POST /admin/students/upload
router.post('/students/upload', async (c) => {
  const admin   = c.get('admin')
  const body    = await c.req.json()
  const rows    = body.rows
  const batchId = body.batch_id ?? uuid()

  if (!Array.isArray(rows) || rows.length === 0) {
    return c.json({ error: 'No rows provided.' }, 400)
  }

  const VALID_LEVELS = ['100','200','300','400','500']
  const errors = []
  rows.forEach((r, i) => {
    if (!r.matric_number?.trim()) errors.push(`Row ${i+1}: missing matric_number`)
    if (!r.full_name?.trim())     errors.push(`Row ${i+1}: missing full_name`)
    if (!VALID_LEVELS.includes(String(r.level).trim())) errors.push(`Row ${i+1}: invalid level "${r.level}"`)
  })
  if (errors.length > 0) return c.json({ error: 'Validation failed', details: errors }, 422)

  const statements = rows.map(r => ({
    sql: `INSERT INTO approved_students (id, matric_number, full_name, level, eligibility, upload_batch)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(matric_number) DO UPDATE SET
            full_name=excluded.full_name, level=excluded.level,
            eligibility=excluded.eligibility, upload_batch=excluded.upload_batch,
            updated_at=datetime('now')`,
    args: [
      uuid(),
      r.matric_number.trim().toUpperCase(),
      r.full_name.trim(),
      String(r.level).trim(),
      (r.eligibility || 'eligible').toLowerCase(),
      batchId,
    ],
  }))

  await db.batch(statements, 'write')
  await audit('student_list_uploaded', {
    actorId: admin.id, actorEmail: admin.email,
    payload: { count: rows.length, batch_id: batchId },
  })

  return c.json({ success: true, count: rows.length, batch_id: batchId })
})

// ----------------------------------------------------------------
// Registrations
// ----------------------------------------------------------------

// GET /admin/registrations
router.get('/registrations', async (c) => {
  const level  = c.req.query('level')
  const search = c.req.query('search')
  const status = c.req.query('status')
  let sql  = `SELECT id, matric_number, full_name, level, status, registered_at FROM registrations WHERE 1=1`
  const args = []
  if (level)  { sql += ` AND level = ?`;                                          args.push(level) }
  if (status) { sql += ` AND status = ?`;                                         args.push(status) }
  if (search) { sql += ` AND (matric_number LIKE ? OR full_name LIKE ?)`;
                args.push(`%${search}%`, `%${search}%`) }
  sql += ` ORDER BY registered_at DESC`
  const res = await db.execute({ sql, args })
  return c.json(res.rows)
})

// ----------------------------------------------------------------
// Draws
// ----------------------------------------------------------------

// GET /admin/draws
router.get('/draws', async (c) => {
  const res = await db.execute(`SELECT * FROM draws ORDER BY generated_at DESC`)
  return c.json(res.rows)
})

// GET /admin/draws/:drawId/teams  (full roster)
router.get('/draws/:drawId/teams', async (c) => {
  const { drawId } = c.req.param()
  const teamsRes  = await db.execute({ sql: `SELECT * FROM teams WHERE draw_id = ? ORDER BY team_number`, args: [drawId] })

  const teams = await Promise.all(teamsRes.rows.map(async team => {
    const membersRes = await db.execute({
      sql: `SELECT tm.id, tm.is_substitute, tm.slot_position,
                   r.id as reg_id, r.matric_number, r.full_name, r.level
            FROM team_members tm
            JOIN registrations r ON r.id = tm.registration_id
            WHERE tm.team_id = ? ORDER BY tm.slot_position`,
      args: [team.id],
    })
    return {
      ...team,
      team_members: membersRes.rows.map(m => ({
        id: m.id, is_substitute: Boolean(m.is_substitute), slot_position: m.slot_position,
        registrations: { id: m.reg_id, matric_number: m.matric_number, full_name: m.full_name, level: m.level },
      })),
    }
  }))

  return c.json(teams)
})

// POST /admin/draws/generate
router.post('/draws/generate', async (c) => {
  const admin = c.get('admin')
  const body  = await c.req.json().catch(() => ({}))
  const { squad_size, sub_slots, preview_only = true, seed: customSeed } = body

  // Check phase
  const settingsRes = await db.execute(`SELECT * FROM tournament_settings WHERE id=1`)
  const settings    = settingsRes.rows[0]
  const validPhases = ['registration_closed', 'draw_generated']
  if (!validPhases.includes(settings.phase)) {
    return c.json({ success: false, code: 'WRONG_PHASE',
      message: `Registration must be closed first. Current phase: ${settings.phase}` })
  }

  const squadSize = Number(squad_size  ?? settings.squad_size)
  const subSlots  = Number(sub_slots   ?? settings.substitute_slots)
  const totalSize = squadSize + subSlots
  const seed      = customSeed ?? randomSeed()

  // Load confirmed registrations per level
  const LEVELS = ['100','200','300','400','500']
  const buckets = {}
  for (const level of LEVELS) {
    const res = await db.execute({
      sql:  `SELECT id as registration_id, matric_number, full_name, level FROM registrations WHERE level=? AND status='confirmed'`,
      args: [level],
    })
    // Deterministic shuffle using seed
    buckets[level] = res.rows.slice().sort((a, b) => {
      const ha = simpleHash(a.registration_id + seed)
      const hb = simpleHash(b.registration_id + seed)
      return ha - hb
    })
  }

  const totalPlayers = LEVELS.reduce((s, l) => s + buckets[l].length, 0)
  if (totalPlayers === 0) return c.json({ success: false, code: 'NO_PLAYERS', message: 'No confirmed registrations.' })

  const numTeams = Math.floor(totalPlayers / totalSize)
  if (numTeams === 0) return c.json({ success: false, code: 'TOO_FEW_PLAYERS',
    message: `Need at least ${totalSize} players for one team. Currently have ${totalPlayers}.` })

  // Round-robin level-diverse distribution
  const teams = Array.from({ length: numTeams }, (_, i) => ({ team_number: i + 1, members: [] }))

  for (let slot = 1; slot <= totalSize; slot++) {
    for (let tIdx = 0; tIdx < numTeams; tIdx++) {
      const team         = teams[tIdx]
      const levelsInTeam = new Set(team.members.map(m => m.level))
      let picked         = false

      // Prefer level not yet in team
      for (const level of LEVELS) {
        if (levelsInTeam.has(level) || buckets[level].length === 0) continue
        const player = buckets[level].shift()
        team.members.push({ ...player, is_substitute: slot > squadSize, slot_position: slot })
        picked = true; break
      }
      // Fallback: any non-empty bucket
      if (!picked) {
        for (const level of LEVELS) {
          if (buckets[level].length === 0) continue
          const player = buckets[level].shift()
          team.members.push({ ...player, is_substitute: slot > squadSize, slot_position: slot })
          picked = true; break
        }
      }
    }
  }

  // Collect unassigned
  const unassigned = []
  for (const level of LEVELS) {
    for (const p of buckets[level]) {
      unassigned.push({ ...p, reason: `Insufficient players for a complete team of ${totalSize}.` })
    }
  }

  if (preview_only) {
    return c.json({
      success: true, preview: true, seed,
      squad_size: squadSize, substitute_slots: subSlots,
      total_teams: numTeams, total_players: totalPlayers,
      unassigned_count: unassigned.length, unassigned, teams,
    })
  }

  // --- Persist as a transaction ---
  // Supersede existing drafts
  await db.execute(`UPDATE draws SET status='superseded' WHERE status='draft'`)

  const drawId = uuid()
  const stmts  = []

  stmts.push({
    sql: `INSERT INTO draws (id, status, squad_size, substitute_slots, total_teams, total_players, unassigned, seed_value, generated_by)
          VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    args: [drawId, squadSize, subSlots, numTeams, totalPlayers, unassigned.length, seed, admin.id],
  })

  for (const team of teams) {
    const teamId = uuid()
    stmts.push({
      sql:  `INSERT INTO teams (id, draw_id, team_name, team_number) VALUES (?, ?, ?, ?)`,
      args: [teamId, drawId, `Team ${String.fromCharCode(64 + team.team_number)}`, team.team_number],
    })
    for (const m of team.members) {
      stmts.push({
        sql:  `INSERT INTO team_members (id, team_id, registration_id, is_substitute, slot_position) VALUES (?, ?, ?, ?, ?)`,
        args: [uuid(), teamId, m.registration_id, m.is_substitute ? 1 : 0, m.slot_position],
      })
    }
  }

  for (const u of unassigned) {
    stmts.push({
      sql:  `INSERT INTO unassigned_players (id, draw_id, registration_id, reason) VALUES (?, ?, ?, ?)`,
      args: [uuid(), drawId, u.registration_id, u.reason],
    })
  }

  stmts.push({ sql: `UPDATE tournament_settings SET phase='draw_generated', updated_at=datetime('now') WHERE id=1`, args: [] })

  await db.batch(stmts, 'write')

  await audit('draw_generated', {
    actorId: admin.id, actorEmail: admin.email,
    targetId: drawId, targetType: 'draw',
    payload: { teams: numTeams, players: totalPlayers, unassigned: unassigned.length, seed },
  })

  return c.json({ success: true, preview: false, draw_id: drawId, seed, total_teams: numTeams,
    total_players: totalPlayers, unassigned_count: unassigned.length, unassigned })
})

// POST /admin/draws/:drawId/publish
router.post('/draws/:drawId/publish', async (c) => {
  const admin    = c.get('admin')
  const { drawId } = c.req.param()

  const drawRes = await db.execute({ sql: `SELECT * FROM draws WHERE id=?`, args: [drawId] })
  const draw    = drawRes.rows[0]
  if (!draw)              return c.json({ success: false, code: 'DRAW_NOT_FOUND' }, 404)
  if (draw.status !== 'draft') return c.json({ success: false, code: 'DRAW_NOT_DRAFT',
    message: `Only draft draws can be published. Current status: ${draw.status}` })

  const teamCount = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM teams WHERE draw_id=?`, args: [drawId] })
  if (Number(teamCount.rows[0]?.cnt ?? 0) === 0)
    return c.json({ success: false, code: 'NO_TEAMS', message: 'Cannot publish an empty draw.' })

  await db.batch([
    { sql: `UPDATE draws SET status='published', published_by=?, published_at=datetime('now') WHERE id=?`, args: [admin.id, drawId] },
    { sql: `UPDATE tournament_settings SET phase='draw_published', updated_at=datetime('now') WHERE id=1`, args: [] },
  ], 'write')

  // Initialise standings rows for all teams
  const teams = await db.execute({ sql: `SELECT id FROM teams WHERE draw_id=?`, args: [drawId] })
  const standingStmts = teams.rows.map(t => ({
    sql:  `INSERT OR IGNORE INTO standings (id, draw_id, team_id) VALUES (?, ?, ?)`,
    args: [uuid(), drawId, t.id],
  }))
  if (standingStmts.length > 0) await db.batch(standingStmts, 'write')

  await audit('draw_published', {
    actorId: admin.id, actorEmail: admin.email,
    targetId: drawId, targetType: 'draw',
    payload: { teams_published: Number(teamCount.rows[0]?.cnt) },
  })

  return c.json({ success: true, draw_id: drawId, published_at: new Date().toISOString(),
    teams_published: Number(teamCount.rows[0]?.cnt) })
})

// ----------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------

// POST /admin/fixtures
router.post('/fixtures', async (c) => {
  const admin = c.get('admin')
  const body  = await c.req.json()
  const { draw_id, home_team_id, away_team_id, round, match_number, venue, scheduled_at } = body

  if (!draw_id || !home_team_id || !away_team_id || home_team_id === away_team_id)
    return c.json({ error: 'draw_id, home_team_id and away_team_id (distinct) are required.' }, 400)

  const id = uuid()
  await db.execute({
    sql:  `INSERT INTO fixtures (id, draw_id, home_team_id, away_team_id, round, match_number, venue, scheduled_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, draw_id, home_team_id, away_team_id, round ?? 1, match_number ?? Date.now(), venue ?? null, scheduled_at ?? null, admin.id],
  })
  await audit('fixture_created', { actorId: admin.id, actorEmail: admin.email,
    targetId: id, targetType: 'fixture', payload: { draw_id, round } })

  return c.json({ id, success: true })
})

// PATCH /admin/fixtures/:id/score
router.patch('/fixtures/:id/score', async (c) => {
  const admin      = c.get('admin')
  const { id }     = c.req.param()
  const { home_score, away_score } = await c.req.json()

  if (home_score == null || away_score == null || isNaN(home_score) || isNaN(away_score))
    return c.json({ error: 'home_score and away_score are required numbers.' }, 400)

  const fixtureRes = await db.execute({ sql: `SELECT * FROM fixtures WHERE id=?`, args: [id] })
  const fixture    = fixtureRes.rows[0]
  if (!fixture) return c.json({ error: 'Fixture not found.' }, 404)

  await db.execute({
    sql:  `UPDATE fixtures SET home_score=?, away_score=?, status='completed', updated_by=?, updated_at=datetime('now') WHERE id=?`,
    args: [Number(home_score), Number(away_score), admin.id, id],
  })

  // Recompute standings
  await recomputeStandings(fixture.draw_id)

  await audit('score_entered', { actorId: admin.id, actorEmail: admin.email,
    targetId: id, targetType: 'fixture', payload: { home_score, away_score } })

  return c.json({ success: true })
})

// ----------------------------------------------------------------
// Audit log
// ----------------------------------------------------------------

// GET /admin/audit
router.get('/audit', async (c) => {
  const limit  = Number(c.req.query('limit')  ?? 50)
  const offset = Number(c.req.query('offset') ?? 0)
  const res = await db.execute({
    sql:  `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [limit, offset],
  })
  return c.json(res.rows.map(r => ({ ...r, payload: JSON.parse(r.payload ?? '{}') })))
})

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

export default router
