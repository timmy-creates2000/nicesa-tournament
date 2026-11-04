import { Hono } from 'hono'
import { db } from '../db/client.js'

const router = new Hono()

// GET /tournament/settings
router.get('/settings', async (c) => {
  const res = await db.execute(`SELECT * FROM tournament_settings WHERE id = 1`)
  return c.json(res.rows[0] ?? null)
})

// GET /tournament/registration-summary
router.get('/registration-summary', async (c) => {
  const res = await db.execute(`
    SELECT level, COUNT(*) as confirmed_count
    FROM registrations
    WHERE status = 'confirmed'
    GROUP BY level
    ORDER BY level
  `)
  return c.json(res.rows)
})

// GET /tournament/fixtures
router.get('/fixtures', async (c) => {
  const drawId = c.req.query('draw_id')
  let sql = `
    SELECT f.*,
      ht.id as home_team_id_ref, ht.team_name as home_team_name, ht.team_number as home_team_number,
      at.id as away_team_id_ref, at.team_name as away_team_name, at.team_number as away_team_number
    FROM fixtures f
    JOIN teams ht ON ht.id = f.home_team_id
    JOIN teams at ON at.id = f.away_team_id
  `
  const args = []
  if (drawId) { sql += ` WHERE f.draw_id = ?`; args.push(drawId) }
  sql += ` ORDER BY f.round, f.match_number`

  const res = await db.execute({ sql, args })
  // Shape the response to match the Supabase nested format the frontend expects
  return c.json(res.rows.map(f => ({
    id:          f.id,
    draw_id:     f.draw_id,
    round:       f.round,
    match_number: f.match_number,
    venue:       f.venue,
    scheduled_at: f.scheduled_at,
    status:      f.status,
    home_score:  f.home_score,
    away_score:  f.away_score,
    home_team: { id: f.home_team_id, team_name: f.home_team_name, team_number: f.home_team_number },
    away_team: { id: f.away_team_id, team_name: f.away_team_name, team_number: f.away_team_number },
  })))
})

// GET /tournament/standings
router.get('/standings', async (c) => {
  const drawId = c.req.query('draw_id')
  let sql = `
    SELECT s.*, t.id as team_id_ref, t.team_name, t.team_number
    FROM standings s
    JOIN teams t ON t.id = s.team_id
  `
  const args = []
  if (drawId) { sql += ` WHERE s.draw_id = ?`; args.push(drawId) }
  sql += ` ORDER BY s.points DESC, (s.goals_for - s.goals_against) DESC, s.goals_for DESC`

  const res = await db.execute({ sql, args })
  return c.json(res.rows.map(s => ({
    ...s,
    teams: { id: s.team_id, team_name: s.team_name, team_number: s.team_number },
  })))
})

// GET /tournament/teams/:teamId
router.get('/teams/:teamId', async (c) => {
  const { teamId } = c.req.param()

  const teamRes = await db.execute({
    sql:  `SELECT t.*, d.status as draw_status FROM teams t JOIN draws d ON d.id = t.draw_id WHERE t.id = ?`,
    args: [teamId],
  })
  const team = teamRes.rows[0]
  if (!team) return c.json({ error: 'Team not found' }, 404)

  // Public: only return data if draw is published
  const settingsRes = await db.execute(`SELECT phase FROM tournament_settings WHERE id=1`)
  const phase       = settingsRes.rows[0]?.phase
  const isPublished = ['draw_published','in_progress','completed'].includes(phase)
  if (!isPublished && team.draw_status !== 'published') {
    return c.json({ error: 'Team not available' }, 403)
  }

  const membersRes = await db.execute({
    sql: `SELECT tm.id, tm.is_substitute, tm.slot_position,
                 r.id as reg_id, r.matric_number, r.full_name, r.level
          FROM team_members tm
          JOIN registrations r ON r.id = tm.registration_id
          WHERE tm.team_id = ?
          ORDER BY tm.slot_position`,
    args: [teamId],
  })

  return c.json({
    ...team,
    team_members: membersRes.rows.map(m => ({
      id:           m.id,
      is_substitute: Boolean(m.is_substitute),
      slot_position: m.slot_position,
      registrations: { id: m.reg_id, matric_number: m.matric_number, full_name: m.full_name, level: m.level },
    })),
  })
})

export default router
