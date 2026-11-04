/**
 * Installs @vitejs/plugin-react-swc and its @swc/core Windows binary.
 * SWC has no Babel dependency — eliminates the entire babel cascade.
 */
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '../node_modules')

async function downloadAndExtract(tarballUrl, destDir) {
  const res = await fetch(tarballUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf     = Buffer.from(await res.arrayBuffer())
  const tmpFile = join(tmpdir(), `swc-${Date.now()}.tgz`)
  writeFileSync(tmpFile, buf)
  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })
  execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' })
}

async function install(pkg, version = 'latest') {
  const enc  = pkg.replace('@', '%40').replace('/', '%2F')
  const meta = await fetch(`https://registry.npmjs.org/${enc}/${version}`).then(r => r.json())
  const parts  = pkg.startsWith('@') ? pkg.split('/') : [pkg]
  const dest   = join(ROOT, ...parts)
  if (parts.length > 1) mkdirSync(join(ROOT, parts[0]), { recursive: true })
  process.stdout.write(`📦  ${pkg}@${meta.version}... `)
  await downloadAndExtract(meta.dist.tarball, dest)
  console.log('✅')
  return meta
}

// Install @vitejs/plugin-react-swc (no babel needed)
await install('@vitejs/plugin-react-swc', 'latest')

// Install @swc/core
const swcCore = await install('@swc/core', 'latest')

// Install the Windows x64 binary that @swc/core needs
console.log('📦  @swc/core-win32-x64-msvc (Windows binary)...')
const winMeta = await fetch('https://registry.npmjs.org/@swc%2Fcore-win32-x64-msvc/latest').then(r => r.json())
mkdirSync(join(ROOT, '@swc'), { recursive: true })
await downloadAndExtract(winMeta.dist.tarball, join(ROOT, '@swc', 'core-win32-x64-msvc'))
console.log('✅')

// Install @swc/counter (tiny dep of @swc/core)
await install('@swc/counter', 'latest')

console.log('\n🎉  SWC installed. Updating vite.config.js...')
