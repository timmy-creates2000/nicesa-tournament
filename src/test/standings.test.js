/**
 * Tests for standings calculation logic.
 * Mirrors the recompute_standings() SQL function in pure JS.
 */
import { describe, it, expect } from 'vitest'

function computeStandings(fixtures, teams) {
  return teams.map(team => {
    const completed = fixtures.filter(
      f => f.status === 'completed' &&
           (f.home_team_id === team.id || f.away_team_id === team.id)
    )

    let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0

    for (const f of completed) {
      const isHome  = f.home_team_id === team.id
      const myScore = isHome ? f.home_score : f.away_score
      const opScore = isHome ? f.away_score : f.home_score

      gf += myScore
      ga += opScore

      if (myScore > opScore)       won++
      else if (myScore === opScore) drawn++
      else                         lost++
    }

    return {
      team_id: team.id,
      team_name: team.team_name,
      played: completed.length,
      won, drawn, lost,
      goals_for: gf,
      goals_against: ga,
      goal_difference: gf - ga,
      points: won * 3 + drawn,
    }
  }).sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for
  )
}

const teams = [
  { id: 'team-a', team_name: 'Team A' },
  { id: 'team-b', team_name: 'Team B' },
  { id: 'team-c', team_name: 'Team C' },
]

describe('Standings calculation', () => {
  it('all teams start at zero with no completed fixtures', () => {
    const standings = computeStandings([], teams)
    standings.forEach(s => {
      expect(s.played).toBe(0)
      expect(s.points).toBe(0)
    })
  })

  it('awards 3 points to winner, 0 to loser', () => {
    const fixtures = [{
      id: 'f1', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: 3, away_score: 1, status: 'completed',
    }]
    const standings = computeStandings(fixtures, teams)
    const a = standings.find(s => s.team_id === 'team-a')
    const b = standings.find(s => s.team_id === 'team-b')
    expect(a.points).toBe(3)
    expect(b.points).toBe(0)
  })

  it('awards 1 point each for a draw', () => {
    const fixtures = [{
      id: 'f1', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: 2, away_score: 2, status: 'completed',
    }]
    const standings = computeStandings(fixtures, teams)
    const a = standings.find(s => s.team_id === 'team-a')
    const b = standings.find(s => s.team_id === 'team-b')
    expect(a.points).toBe(1)
    expect(b.points).toBe(1)
    expect(a.drawn).toBe(1)
    expect(b.drawn).toBe(1)
  })

  it('correctly counts played, won, drawn, lost across multiple fixtures', () => {
    const fixtures = [
      { id: 'f1', home_team_id: 'team-a', away_team_id: 'team-b', home_score: 2, away_score: 0, status: 'completed' },
      { id: 'f2', home_team_id: 'team-a', away_team_id: 'team-c', home_score: 1, away_score: 1, status: 'completed' },
      { id: 'f3', home_team_id: 'team-b', away_team_id: 'team-c', home_score: 0, away_score: 3, status: 'completed' },
    ]
    const standings = computeStandings(fixtures, teams)
    const a = standings.find(s => s.team_id === 'team-a')
    const b = standings.find(s => s.team_id === 'team-b')
    const c = standings.find(s => s.team_id === 'team-c')

    expect(a).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4 })
    expect(b).toMatchObject({ played: 2, won: 0, drawn: 0, lost: 2, points: 0 })
    expect(c).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4 })
  })

  it('does not count scheduled fixtures', () => {
    const fixtures = [{
      id: 'f1', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, status: 'scheduled',
    }]
    const standings = computeStandings(fixtures, teams)
    standings.forEach(s => expect(s.played).toBe(0))
  })

  it('sorts by points descending', () => {
    const fixtures = [
      { id: 'f1', home_team_id: 'team-a', away_team_id: 'team-b', home_score: 3, away_score: 0, status: 'completed' },
      { id: 'f2', home_team_id: 'team-b', away_team_id: 'team-c', home_score: 1, away_score: 1, status: 'completed' },
    ]
    const standings = computeStandings(fixtures, teams)
    expect(standings[0].team_id).toBe('team-a') // 3 pts
    expect(standings[2].team_id).toBe('team-c') // 1 pt or 0 pts below a
  })

  it('uses goal difference as tiebreaker', () => {
    const fixtures = [
      { id: 'f1', home_team_id: 'team-a', away_team_id: 'team-c', home_score: 3, away_score: 0, status: 'completed' },
      { id: 'f2', home_team_id: 'team-b', away_team_id: 'team-c', home_score: 1, away_score: 0, status: 'completed' },
    ]
    const standings = computeStandings(fixtures, teams)
    const a = standings.find(s => s.team_id === 'team-a')
    const b = standings.find(s => s.team_id === 'team-b')
    // Both have 3 pts, but A has +3 GD vs B's +1 GD
    expect(a.points).toBe(3)
    expect(b.points).toBe(3)
    expect(standings.indexOf(a)).toBeLessThan(standings.indexOf(b))
  })
})
