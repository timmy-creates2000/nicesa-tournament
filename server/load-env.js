/**
 * Preload script — loads .env.local before any other module.
 * Usage: node --import ./server/load-env.js server/index.js
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const lines = readFileSync(join(__dirname, '../.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key) process.env[key] = val
  }
} catch {
  // .env.local is optional if env vars are set by the hosting platform
}
