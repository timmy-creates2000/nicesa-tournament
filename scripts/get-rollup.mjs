/**
 * Downloads rollup + Windows binary directly, no npm needed.
 * Uses only Node built-ins.
 */
import { mkdirSync, writeFileSync, existsSync, createWriteStream } from 'fs'
import { createGunzip } from 'zlib'
import { Readable } from 'stream'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODULES   = join(__dirname, '../node_modules')

async function fetchBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function downloadAndExtract(tarballUrl, destDir) {
  console.log('  Downloading:', tarballUrl.split('/').pop())
  const buf     = await fetchBuffer(tarballUrl)
  const tmpFile = join(tmpdir(), `rollup-${Date.now()}.tgz`)
  writeFileSync(tmpFile, buf)
  mkdirSync(destDir, { recursive: true })
  // Use tar.exe which is built into Windows 10+
  execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' })
  console.log('  Extracted to:', destDir)
}

// ── rollup ────────────────────────────────────────────────────────
const rollupDest = join(MODULES, 'rollup')
if (!existsSync(join(rollupDest, 'package.json'))) {
  console.log('📦  Installing rollup@4.67.5...')
  const meta = await fetch('https://registry.npmjs.org/rollup/4.67.5').then(r => r.json())
  await downloadAndExtract(meta.dist.tarball, rollupDest)
} else {
  console.log('⏭️   rollup already present')
}

// ── @rollup/rollup-win32-x64-msvc ────────────────────────────────
const winDest = join(MODULES, '@rollup', 'rollup-win32-x64-msvc')
if (!existsSync(join(winDest, 'package.json'))) {
  console.log('📦  Installing @rollup/rollup-win32-x64-msvc@4.67.5...')
  const meta = await fetch('https://registry.npmjs.org/@rollup%2Frollup-win32-x64-msvc/4.67.5').then(r => r.json())
  mkdirSync(join(MODULES, '@rollup'), { recursive: true })
  await downloadAndExtract(meta.dist.tarball, winDest)
} else {
  console.log('⏭️   @rollup/rollup-win32-x64-msvc already present')
}

console.log('\n✅  Done — Vite should now work.')
