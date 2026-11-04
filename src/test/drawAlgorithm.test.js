/**
 * Tests for the team-draw distribution algorithm.
 *
 * These tests exercise the JavaScript-equivalent logic of the SQL
 * generate_team_draw() function (the deterministic shuffling and
 * level-diversity distribution), so we can validate edge cases
 * without a live Supabase instance.
 */
import { describe, it, expect } from 'vitest'

// ----------------------------------------------------------------
// Pure JS implementation of the draw algorithm
// (mirrors the SQL logic in 002_draw_functions.sql)
// ----------------------------------------------------------------

const LEVELS = ['100', '200', '300', '400', '500']

/**
 * Deterministic shuffle using a seed string.
 * Mirrors: ORDER BY md5(id || seed)
 */
function seededShuffle(arr, seed) {
  return [...arr].sort((a, b) => {
    const ha = simpleHash(a.registration_id + seed)
    const hb = simpleHash(b.registration_id + seed)
    return ha - hb
  })
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/**
 * Build per-level buckets, shuffle each with seed.
 */
function buildBuckets(players, seed) {
  const buckets = {}
  for (const level of LEVELS) {
    buckets[level] = seededShuffle(
      players.filter(p => p.level === level),
      seed
    )
  }
  return buckets
}

/**
 * Core distribution: fill teams round-robin, maximising level diversity.
 * Returns { teams, unassigned }
 */
function distributeTeams(players, squadSize = 5, subSlots = 0, seed = 'test-seed') {
  const totalSize  = squadSize + subSlots
  const numTeams   = Math.floor(players.length / totalSize)

  if (numTeams === 0) {
    return { teams: [], unassigned: players.map(p => ({ ...p, reason: 'Too few players' })) }
  }

  const buckets = buildBuckets(players, seed)
  const teams   = Array.from({ length: numTeams }, (_, i) => ({
    team_number: i + 1,
    members: [],
  }))

  for (let slot = 1; slot <= totalSize; slot++) {
    for (let tIdx = 0; tIdx < numTeams; tIdx++) {
      const team         = teams[tIdx]
      const levelsInTeam = new Set(team.members.map(m => m.level))
      let picked         = false

      // Prefer a level not yet in this team
      for (const level of LEVELS) {
        if (levelsInTeam.has(level)) continue
        if (buckets[level].length === 0) continue
        const player = buckets[level].shift()
        team.members.push({ ...player, is_substitute: slot > squadSize, slot_position: slot })
        picked = true
        break
      }

      // Fallback: pick from any non-empty bucket
      if (!picked) {
        for (const level of LEVELS) {
          if (buckets[level].length === 0) continue
          const player = buckets[level].shift()
          team.members.push({ ...player, is_substitute: slot > squadSize, slot_position: slot })
          picked = true
          break
        }
      }
    }
  }

  // Collect unassigned
  const unassigned = []
  for (const level of LEVELS) {
    for (const p of buckets[level]) {
      unassigned.push({
        ...p,
        reason: `Insufficient players for a complete team of ${totalSize}.`,
      })
    }
  }

  return { teams, unassigned }
}

// ----------------------------------------------------------------
// Helpers for building test player sets
// ----------------------------------------------------------------

function makePlayers(countPerLevel) {
  const players = []
  let id = 1
  for (const [level, count] of Object.entries(countPerLevel)) {
    for (let i = 0; i < count; i++) {
      players.push({
        registration_id: `reg-${id++}`,
        matric_number:   `CVE/2024/${String(id).padStart(3,'0')}`,
        full_name:       `Student ${id}`,
        level,
      })
    }
  }
  return players
}

// ================================================================
// TEST SUITES
// ================================================================

describe('Draw Algorithm — even distribution (5 players per level)', () => {
  const players = makePlayers({ '100': 5, '200': 5, '300': 5, '400': 5, '500': 5 })

  it('assigns all 25 players when squad size is 5 and no subs', () => {
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    const totalAssigned = teams.reduce((a, t) => a + t.members.length, 0)
    expect(totalAssigned).toBe(25)
    expect(unassigned).toHaveLength(0)
  })

  it('creates exactly 5 teams of 5', () => {
    const { teams } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(5)
    teams.forEach(t => expect(t.members).toHaveLength(5))
  })

  it('each team has exactly one player from each level', () => {
    const { teams } = distributeTeams(players, 5, 0)
    teams.forEach(team => {
      const levels = team.members.map(m => m.level)
      expect(new Set(levels).size).toBe(5)
      LEVELS.forEach(l => expect(levels).toContain(l))
    })
  })

  it('no player appears in more than one team', () => {
    const { teams } = distributeTeams(players, 5, 0)
    const allIds = teams.flatMap(t => t.members.map(m => m.registration_id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('with 2 substitutes, teams have 7 members each (5 starters + 2 subs)', () => {
    const bigPlayers = makePlayers({ '100': 7, '200': 7, '300': 7, '400': 7, '500': 7 })
    const { teams, unassigned } = distributeTeams(bigPlayers, 5, 2)
    expect(teams).toHaveLength(5)
    teams.forEach(t => {
      expect(t.members).toHaveLength(7)
      expect(t.members.filter(m => !m.is_substitute)).toHaveLength(5)
      expect(t.members.filter(m =>  m.is_substitute)).toHaveLength(2)
    })
    expect(unassigned).toHaveLength(0)
  })
})

describe('Draw Algorithm — unequal level counts', () => {
  it('handles more players in one level: maximises diversity, reports unassigned', () => {
    // 10 from 100L, 3 each from 200-500 → 10+3+3+3+3 = 22 players
    // Squad size 5, no subs → 4 complete teams (20 players), 2 unassigned
    const players = makePlayers({ '100': 10, '200': 3, '300': 3, '400': 3, '500': 3 })
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(4)
    expect(unassigned).toHaveLength(2)
    // Unassigned should all be from level 100 (excess)
    unassigned.forEach(p => expect(p.level).toBe('100'))
  })

  it('maximises level diversity even with imbalance', () => {
    const players = makePlayers({ '100': 6, '200': 4, '300': 3, '400': 4, '500': 3 })
    // 20 players → 4 teams of 5
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(4)
    expect(unassigned).toHaveLength(0)
    // Each team should have players from at least 3 different levels
    teams.forEach(team => {
      const levels = new Set(team.members.map(m => m.level))
      expect(levels.size).toBeGreaterThanOrEqual(3)
    })
  })

  it('handles single-level registration', () => {
    const players = makePlayers({ '100': 10, '200': 0, '300': 0, '400': 0, '500': 0 })
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(2)
    expect(unassigned).toHaveLength(0)
    // All players are in teams, even though no diversity is possible
    const allIds = teams.flatMap(t => t.members.map(m => m.registration_id))
    expect(new Set(allIds).size).toBe(10)
  })
})

describe('Draw Algorithm — incomplete teams', () => {
  it('does not create a team when there are fewer players than squad size', () => {
    const players = makePlayers({ '100': 1, '200': 1, '300': 1, '400': 1, '500': 1 })
    // 5 players, squad size 5 → 1 team, 0 unassigned
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(1)
    expect(unassigned).toHaveLength(0)
  })

  it('returns zero teams and all unassigned when players < squad size', () => {
    const players = makePlayers({ '100': 1, '200': 1, '300': 1, '400': 0, '500': 0 })
    // 3 players, squad size 5 → 0 teams, 3 unassigned
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    expect(teams).toHaveLength(0)
    expect(unassigned).toHaveLength(3)
  })

  it('reports every eligible player — none silently discarded', () => {
    const players = makePlayers({ '100': 7, '200': 6, '300': 5, '400': 4, '500': 3 })
    // 25 players, squad 5, no subs → 5 teams, 0 unassigned
    const { teams, unassigned } = distributeTeams(players, 5, 0)
    const assigned = teams.flatMap(t => t.members.map(m => m.registration_id))
    const unassignedIds = unassigned.map(u => u.registration_id)
    const allIds = players.map(p => p.registration_id)

    // Every player must appear in exactly one list
    allIds.forEach(id => {
      const inAssigned   = assigned.includes(id)
      const inUnassigned = unassignedIds.includes(id)
      expect(inAssigned || inUnassigned).toBe(true)
      expect(inAssigned && inUnassigned).toBe(false)
    })
  })
})

describe('Draw Algorithm — reproducibility', () => {
  it('produces the same draw given the same seed', () => {
    const players = makePlayers({ '100': 5, '200': 5, '300': 5, '400': 5, '500': 5 })
    const result1 = distributeTeams(players, 5, 0, 'fixed-seed-abc')
    const result2 = distributeTeams(players, 5, 0, 'fixed-seed-abc')
    const ids1 = result1.teams.flatMap(t => t.members.map(m => m.registration_id))
    const ids2 = result2.teams.flatMap(t => t.members.map(m => m.registration_id))
    expect(ids1).toEqual(ids2)
  })

  it('produces a different draw with a different seed', () => {
    const players = makePlayers({ '100': 5, '200': 5, '300': 5, '400': 5, '500': 5 })
    const result1 = distributeTeams(players, 5, 0, 'seed-one')
    const result2 = distributeTeams(players, 5, 0, 'seed-two')
    const ids1 = result1.teams.flatMap(t => t.members.map(m => m.registration_id))
    const ids2 = result2.teams.flatMap(t => t.members.map(m => m.registration_id))
    // Very likely to differ (not guaranteed but safe for 25 players)
    expect(ids1).not.toEqual(ids2)
  })
})

describe('Draw Algorithm — configurable squad size', () => {
  it('supports squad size of 7 with 3 subs (10 total per team)', () => {
    const players = makePlayers({ '100': 4, '200': 4, '300': 4, '400': 4, '500': 4 })
    // 20 players, totalSize=10 → 2 teams
    const { teams, unassigned } = distributeTeams(players, 7, 3)
    expect(teams).toHaveLength(2)
    expect(unassigned).toHaveLength(0)
    teams.forEach(t => {
      expect(t.members.filter(m => !m.is_substitute)).toHaveLength(7)
      expect(t.members.filter(m =>  m.is_substitute)).toHaveLength(3)
    })
  })
})
