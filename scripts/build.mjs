// Build order: offline single file first, hash it, then the online site with the hash baked in.
// The online page can't fetch the .sha256 at runtime (CSP connect-src 'none'), so it's injected at build time.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const FILE = 'AHOY-vanity-wallet-generator-offline.html'
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

run('npx vite build --mode offline')
const sha = createHash('sha256').update(readFileSync('dist-offline/index.html')).digest('hex')
run('npx vite build', { VITE_OFFLINE_SHA256: sha })
copyFileSync('dist-offline/index.html', `dist/${FILE}`) // published byte-for-byte, so the hash matches the served file
writeFileSync(`dist/${FILE}.sha256`, `${sha}  ${FILE}\n`)
console.log(`SHA-256 ${sha}  ${FILE}`)
