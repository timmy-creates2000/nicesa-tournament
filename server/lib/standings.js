import { db } from '../db/client.js'
import { uuid } from './id.js'

/**
 * Recompute standings for every team in a draw.
 * Called after any fixture score update.
 */
export async function recomputeStandings(drawId) {
  const teams = await db.execute({
    sql:  `SELECT id FROM teams WHERE draw_id = ?`,
    args: [drawId],
  })

  const upserts = []

  for (const team of teams.rows) {
    const fixtures = await db.execute({
      sql: `SELECT home_team_id, away_team_id, home_score, away_score
            FROM fixtures
            WHERE draw_id = ? AND status = 'completed'
              AND (home_team_id = ? OR away_team_id = ?)`,
      args: [drawId, team.id, team.id],
    })

    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0

    for (const f of fixtures.rows) {
      const isHome  = f.home_team_id === team.id
      const myScore = isHome ? Number(f.home_score) : Number(f.away_score)
      const opScore = isHome ? Number(f.away_score) : Number(f.home_score)

      played++
      gf += myScore
      ga += opScore

      if (myScore > opScore)       won++
      else if (myScore === opScore) drawn++
      else                          lost++
    }

    const points = won * 3 + drawn

    // Check if row exists
    const existing = await db.execute({
      sql:  `SELECT id FROM standings WHERE draw_id = ? AND team_id = ?`,
      args: [drawId, team.id],
    })

    if (existing.rows.length > 0) {
      upserts.push({
        sql: `UPDATE standings
              SET played=?, won=?, drawn=?, lost=?, goals_for=?, goals_against=?, points=?, updated_at=datetime('now')
              WHERE draw_id=? AND team_id=?`,
        args: [played, won, drawn, lost, gf, ga, points, drawId, team.id],
      })
    } else {
      upserts.push({
        sql: `INSERT INTO standings (id, draw_id, team_id, played, won, drawn, lost, goals_for, goals_against, points)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [uuid(), drawId, team.id, played, won, drawn, lost, gf, ga, points],
      })
    }
  }

  if (upserts.length > 0) {
    await db.batch(upserts, 'write')
  }
}
