/**
 * NICESA Tournament — Hono API Server
 * Entry point: node server/index.js  (or npm run dev:api)
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Load .env.local before anything else ──────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const lines = readFileSync(join(__dirname, '../.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t  = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key) process.env[key] = val
  }
} catch { /* .env.local optional if env vars already set */ }

// ── Imports (after env is loaded) ─────────────────────────────────
import { serve }    from '@hono/node-server'
import { Hono }     from 'hono'
import { cors }     from 'hono/cors'
import { logger }   from 'hono/logger'

import authRouter       from './routes/auth.js'
import registerRouter   from './routes/register.js'
import tournamentRouter from './routes/tournament.js'
import adminRouter      from './routes/admin.js'

// ── App ────────────────────────────────────────────────────────────
const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin:      process.env.FRONTEND_URL ?? '*',
  credentials: true,
}))

// Health check
app.get('/health', c => c.json({ ok: true, ts: new Date().toISOString() }))

// Routes
app.route('/auth',       authRouter)
app.route('/register',   registerRouter)
app.route('/tournament', tournamentRouter)
app.route('/admin',      adminRouter)

// 404 fallback
app.notFound(c => c.json({ error: 'Not found' }, 404))

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Start ──────────────────────────────────────────────────────────
const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`\n🚀  NICESA API running on http://localhost:${port}`)
  console.log(`   Health: http://localhost:${port}/health\n`)
})
