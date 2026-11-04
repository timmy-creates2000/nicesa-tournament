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
} catch {}

const url   = process.env.TURSO_DATABASE_URL
const token = process.env.TURSO_AUTH_TOKEN

console.log('URL  :', url)
console.log('Token:', token?.slice(0, 40) + '...')

// Use the Hrana HTTP API directly (what @libsql/client/http uses under the hood)
const apiUrl = url.replace('libsql://', 'https://').replace('https://', 'https://') + '/v2/pipeline'

try {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql: 'SELECT 1 as ping' } },
        { type: 'close' },
      ],
    }),
  })

  const text = await res.text()
  console.log('\nStatus:', res.status)
  console.log('Body  :', text.slice(0, 200))

  if (res.ok) {
    console.log('\n✅  Connection successful!')
  } else {
    console.log('\n❌  HTTP', res.status, '— token may be invalid or wrong database URL')
  }
} catch (e) {
  console.log('\n❌  Fetch error:', e.message)
}
process.exit(0)
