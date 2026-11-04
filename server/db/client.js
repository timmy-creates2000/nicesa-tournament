/**
 * Turso database client using the Hrana HTTP API directly.
 * Avoids @libsql/client native binary issues with Node 24.
 */

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL is not set. Copy .env.example to .env.local.')
}
if (!process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN is not set.')
}

const BASE_URL = process.env.TURSO_DATABASE_URL
  .replace('libsql://', 'https://')
const TOKEN    = process.env.TURSO_AUTH_TOKEN
const PIPELINE = `${BASE_URL}/v2/pipeline`

/**
 * Execute a single SQL statement with optional args.
 * Returns { rows, columns, rowsAffected }
 */
export async function execute(sql, args = []) {
  // Turso expects positional args as [{ type, value }] or named
  const stmt = args.length > 0
    ? { sql, args: args.map(toHranaValue) }
    : { sql }

  const res  = await pipeline([
    { type: 'execute', stmt },
    { type: 'close' },
  ])

  const result = res.results[0]
  if (result.type === 'error') {
    throw new Error(result.error?.message ?? 'SQL execution failed')
  }

  const raw  = result.response.result
  const cols = raw.cols.map(c => c.name)
  const rows = raw.rows.map(row => {
    const obj = {}
    row.forEach((cell, i) => { obj[cols[i]] = fromHranaValue(cell) })
    return obj
  })

  return { rows, columns: cols, rowsAffected: raw.affected_row_count ?? 0 }
}

/**
 * Execute multiple statements as a batch (all-or-nothing).
 * Each item: { sql, args? }
 */
export async function batch(statements) {
  const requests = statements.map(s => ({
    type: 'execute',
    stmt: s.args?.length
      ? { sql: s.sql, args: s.args.map(toHranaValue) }
      : { sql: s.sql },
  }))
  requests.push({ type: 'close' })

  const res = await pipeline(requests)

  for (let i = 0; i < statements.length; i++) {
    const r = res.results[i]
    if (r?.type === 'error') {
      throw new Error(`Batch statement ${i+1} failed: ${r.error?.message}`)
    }
  }
  return res.results.slice(0, statements.length)
}

/**
 * Convenience: run query and return first row or null.
 */
export async function queryOne(sql, args = []) {
  const { rows } = await execute(sql, args)
  return rows[0] ?? null
}

// ── db object — same surface area as @libsql/client ───────────────
export const db = {
  execute: (stmtOrSql, args) => {
    if (typeof stmtOrSql === 'string') return execute(stmtOrSql, args)
    return execute(stmtOrSql.sql, stmtOrSql.args)
  },
  batch: (stmts) => batch(stmts),
}

// ── Internal helpers ──────────────────────────────────────────────

async function pipeline(requests) {
  const res = await fetch(PIPELINE, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Turso HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

function toHranaValue(v) {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'number')  return Number.isInteger(v)
    ? { type: 'integer', value: String(v) }
    : { type: 'float',   value: v }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  return { type: 'text', value: String(v) }
}

function fromHranaValue(cell) {
  if (!cell || cell.type === 'null') return null
  if (cell.type === 'integer') return Number(cell.value)
  if (cell.type === 'float')   return Number(cell.value)
  return cell.value ?? null
}
