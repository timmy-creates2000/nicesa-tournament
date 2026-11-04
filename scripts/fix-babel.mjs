/**
 * Installs all @babel/* packages that @vitejs/plugin-react needs,
 * both at the root node_modules level AND nested inside plugin-react.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '../node_modules')
const NESTED    = join(ROOT, '@vitejs', 'plugin-react', 'node_modules')

async function downloadAndExtract(tarballUrl, destDir) {
  const res = await fetch(tarballUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf     = Buffer.from(await res.arrayBuffer())
  const tmpFile = join(tmpdir(), `babel-${Date.now()}.tgz`)
  writeFileSync(tmpFile, buf)
  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })
  execSync(`tar -xzf "${tmpFile}" -C "${destDir}" --strip-components=1`, { stdio: 'pipe' })
}

async function getVersion(pkg, version = 'latest') {
  const enc = pkg.replace('@', '%40').replace('/', '%2F')
  return fetch(`https://registry.npmjs.org/${enc}/${version}`).then(r => r.json())
}

// Full list of @babel packages plugin-react@4 needs
const babelPackages = [
  '@babel/core',
  '@babel/helpers',
  '@babel/parser',
  '@babel/types',
  '@babel/traverse',
  '@babel/generator',
  '@babel/template',
  '@babel/code-frame',
  '@babel/highlight',
  '@babel/helper-module-transforms',
  '@babel/helper-simple-access',
  '@babel/helper-plugin-utils',
  '@babel/plugin-transform-react-jsx',
  '@babel/plugin-transform-react-jsx-development',
  '@babel/plugin-transform-react-pure-annotations',
  '@babel/plugin-syntax-import-meta',
]

for (const pkg of babelPackages) {
  const meta    = await getVersion(pkg)
  const parts   = pkg.split('/')             // ['@babel', 'core']
  const scope   = parts[0]                   // '@babel'
  const name    = parts[1]                   // 'core'

  // Install at root level
  const rootDest   = join(ROOT, scope, name)
  mkdirSync(join(ROOT, scope), { recursive: true })
  if (!existsSync(join(rootDest, 'package.json'))) {
    process.stdout.write(`📦  ${pkg}@${meta.version} (root)... `)
    await downloadAndExtract(meta.dist.tarball, rootDest)
    console.log('✅')
  } else {
    console.log(`⏭️   ${pkg} already at root`)
  }

  // Install nested inside @vitejs/plugin-react/node_modules
  const nestedDest = join(NESTED, scope, name)
  mkdirSync(join(NESTED, scope), { recursive: true })
  process.stdout.write(`📦  ${pkg}@${meta.version} (nested)... `)
  await downloadAndExtract(meta.dist.tarball, nestedDest)
  console.log('✅')
}

console.log('\n🎉  All Babel packages installed. Restart Vite now.')
