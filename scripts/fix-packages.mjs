/**
 * Reinstalls all packages that have incomplete/corrupted files
 * from the partial npm install. Uses only Node built-ins + Windows tar.
 */
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODULES   = join(__dirname, '../node_modules')

async function downloadAndExtract(tarballUrl, destDir) {
  const res = await fetch(tarballUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${tarballUrl}`)
  const buf     = Buffer.from(await res.arrayBuffer())
  const tmpFile = join(tmpdir(), `pkg-${Date.now()}.tgz`)
  writeFileSync(tmpFile, buf)
  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })
  execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' })
}

async function install(pkg, version = 'latest') {
  const encoded = encodeURIComponent(pkg).replace('%40', '@').replace('%2F', '/')
  const url     = `https://registry.npmjs.org/${encoded.replace('@', '%40').replace('/', '%2F')}/${version}`
  const meta    = await fetch(url).then(r => r.json())
  const destDir = join(MODULES, ...pkg.replace(/^@/, '').split('/').map((p, i, a) =>
    i === 0 && pkg.startsWith('@') ? '@' + p : p
  ))

  // handle scoped packages properly
  const parts   = pkg.startsWith('@') ? [pkg.split('/')[0], pkg.split('/')[1]] : [pkg]
  const dest    = join(MODULES, ...parts)

  if (pkg.startsWith('@')) mkdirSync(join(MODULES, parts[0]), { recursive: true })

  console.log(`📦  ${pkg}@${meta.version}`)
  await downloadAndExtract(meta.dist.tarball, dest)
}

// All packages that need reinstalling
const packages = [
  // Vite + React plugin + Babel (plugin-react bundles babel)
  ['@vitejs/plugin-react',      '4.3.4'],
  // Babel packages that plugin-react needs
  ['@babel/core',               'latest'],
  ['@babel/plugin-transform-react-jsx', 'latest'],
  ['@babel/plugin-proposal-decorators', 'latest'],
]

for (const [pkg, ver] of packages) {
  try {
    await install(pkg, ver)
    console.log(`  ✅  done`)
  } catch (e) {
    console.error(`  ❌  ${pkg}: ${e.message}`)
  }
}

// Special case: @vitejs/plugin-react bundles babel inside its own node_modules
// Make sure that nested node_modules exists
const pluginReactBabelDir = join(MODULES, '@vitejs', 'plugin-react', 'node_modules', '@babel', 'core')
console.log('\n📦  Checking nested @babel/core inside @vitejs/plugin-react...')
try {
  const meta = await fetch('https://registry.npmjs.org/%40babel%2Fcore/latest').then(r => r.json())
  mkdirSync(join(MODULES, '@vitejs', 'plugin-react', 'node_modules', '@babel'), { recursive: true })
  await downloadAndExtract(meta.dist.tarball, pluginReactBabelDir)
  console.log('  ✅  nested @babel/core installed')
} catch (e) {
  console.error('  ❌', e.message)
}

console.log('\n🎉  All done — restart Vite now.')
