import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')

// Strip all comment lines first, then split on semicolons
const stripped = schema
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')

const statements = stripped
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 3)

console.log(`🔧  Running ${statements.length} statements against Turso…`)

let applied = 0, skipped = 0
for (const sql of statements) {
  try {
    await db.execute(sql)
    applied++
  } catch (err) {
    if (err.message?.includes('already exists')) { skipped++; continue }
    console.error('❌  Failed:', sql.slice(0, 100).replace(/\s+/g, ' '))
    console.error('   Error :', err.message)
    process.exit(1)
  }
}

console.log(`✅  Done — ${applied} applied, ${skipped} already existed.`)
process.exit(0)
