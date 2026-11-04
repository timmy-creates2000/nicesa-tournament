/**
 * NICESA Tournament — API client
 * Replaces @supabase/supabase-js. All calls go to the Hono server.
 * Base URL is set via VITE_API_URL (default /api — proxied by Vite in dev,
 * reverse-proxied to :3001 in production).
 */

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

// ----------------------------------------------------------------
// Core fetch helpers
// ----------------------------------------------------------------

function getToken() {
  return localStorage.getItem('nicesa_admin_token')
}

function setToken(token) {
  if (token) localStorage.setItem('nicesa_admin_token', token)
  else        localStorage.removeItem('nicesa_admin_token')
}

async function request(method, path, body, requiresAuth = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (requiresAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))

  if (!res.ok) {
    const msg = data?.error ?? data?.message ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

const get    = (path, auth = false)        => request('GET',   path, undefined, auth)
const post   = (path, body, auth = false)  => request('POST',  path, body,      auth)
const patch  = (path, body, auth = false)  => request('PATCH', path, body,      auth)

// ----------------------------------------------------------------
// Auth
// ----------------------------------------------------------------

export async function signIn(email, password) {
  const data = await post('/auth/login', { email, password })
  setToken(data.token)
  return data
}

export async function signOut() {
  setToken(null)
}

export async function getSession() {
  const token = getToken()
  if (!token) return null
  try {
    const data = await get('/auth/me', true)
    return data.authenticated ? { token, admin: data.admin } : null
  } catch {
    setToken(null)
    return null
  }
}

export function isAdmin(session) {
  return !!session?.admin
}

// ----------------------------------------------------------------
// Tournament settings
// ----------------------------------------------------------------

export async function getTournamentSettings() {
  return get('/tournament/settings')
}

export async function updateSettings(updates) {
  return patch('/admin/settings', updates, true)
}

export async function setRegistrationPhase(open) {
  const phase = open ? 'registration_open' : 'registration_closed'
  return patch('/admin/settings', { phase }, true)
}

export async function updateAnnouncement(text) {
  return patch('/admin/settings', { announcement: text }, true)
}

// ----------------------------------------------------------------
// Registration (public)
// ----------------------------------------------------------------

export async function registerStudent(matricNumber) {
  return post('/register', { matric_number: matricNumber.trim().toUpperCase() })
}

export async function getMyTeam(matricNumber) {
  const encoded = encodeURIComponent(matricNumber.trim().toUpperCase())
  return get(`/register/my-team?matric=${encoded}`)
}

// ----------------------------------------------------------------
// Public data
// ----------------------------------------------------------------

export async function getRegistrationSummary() {
  return get('/tournament/registration-summary')
}

export async function getFixtures(drawId) {
  const qs = drawId ? `?draw_id=${drawId}` : ''
  return get(`/tournament/fixtures${qs}`)
}

export async function getStandings(drawId) {
  const qs = drawId ? `?draw_id=${drawId}` : ''
  return get(`/tournament/standings${qs}`)
}

export async function getTeam(teamId) {
  return get(`/tournament/teams/${teamId}`)
}

// ----------------------------------------------------------------
// Admin — students
// ----------------------------------------------------------------

export async function getApprovedStudents({ level, search } = {}) {
  const params = new URLSearchParams()
  if (level)  params.set('level',  level)
  if (search) params.set('search', search)
  const qs = params.toString() ? `?${params}` : ''
  return get(`/admin/students${qs}`, true)
}

export async function upsertApprovedStudents(rows, batchId) {
  return post('/admin/students/upload', { rows, batch_id: batchId }, true)
}

// ----------------------------------------------------------------
// Admin — registrations
// ----------------------------------------------------------------

export async function getRegistrations({ level, search, status } = {}) {
  const params = new URLSearchParams()
  if (level)  params.set('level',  level)
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params}` : ''
  return get(`/admin/registrations${qs}`, true)
}

// ----------------------------------------------------------------
// Admin — draws
// ----------------------------------------------------------------

export async function generateDraw({ squadSize, subSlots, previewOnly = true } = {}) {
  return post('/admin/draws/generate', {
    squad_size:   squadSize ?? null,
    sub_slots:    subSlots  ?? null,
    preview_only: previewOnly,
  }, true)
}

export async function publishDraw(drawId) {
  return post(`/admin/draws/${drawId}/publish`, {}, true)
}

export async function getDraws() {
  return get('/admin/draws', true)
}

export async function getDrawTeams(drawId) {
  return get(`/admin/draws/${drawId}/teams`, true)
}

// ----------------------------------------------------------------
// Admin — fixtures
// ----------------------------------------------------------------

export async function upsertFixture(fixture) {
  return post('/admin/fixtures', fixture, true)
}

export async function updateScore(fixtureId, homeScore, awayScore) {
  return patch(`/admin/fixtures/${fixtureId}/score`, {
    home_score: homeScore,
    away_score: awayScore,
  }, true)
}

// ----------------------------------------------------------------
// Admin — audit log
// ----------------------------------------------------------------

export async function getAuditLog({ limit = 50, offset = 0 } = {}) {
  return get(`/admin/audit?limit=${limit}&offset=${offset}`, true)
}

// ----------------------------------------------------------------
// Real-time polling helper (replaces Supabase real-time)
// Returns a cleanup function.
// ----------------------------------------------------------------

export function poll(fn, intervalMs = 10000) {
  fn() // run immediately
  const id = setInterval(fn, intervalMs)
  return () => clearInterval(id)
}
