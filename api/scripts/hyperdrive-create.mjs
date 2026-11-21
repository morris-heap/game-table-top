// Creates (or updates) the Hyperdrive config for the Optilogic database from the repo-root .env,
// without printing the password. Writes the returned id into wrangler.jsonc.
// Usage: npm run hyperdrive            (create)
//        npm run hyperdrive -- --update (point the existing config at new credentials)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pgConfig } from './env.mjs'
import { wranglerSync as wrangler } from './wrangler.mjs'

const NAME = 'emberreach-db'
const CONFIG = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url))
const c = pgConfig()
const update = process.argv.includes('--update')

let args
if (update) {
  const list = wrangler(['hyperdrive', 'list'])
  const id = (list.stdout.match(new RegExp(`([0-9a-f]{32})[^\\n]*${NAME}`)) ?? [])[1]
  if (!id) throw new Error(`No Hyperdrive config named ${NAME} found`)
  args = ['hyperdrive', 'update', id]
} else {
  args = ['hyperdrive', 'create', NAME]
}
// Pass fields separately (not a URL) so special characters in the password need no escaping.
args.push('--origin-host', c.host, '--origin-port', String(c.port), '--database', c.dbname,
  '--origin-user', c.user, '--origin-password', c.password, '--origin-scheme', 'postgresql',
  // Sheets are read right after they're saved or deleted; cached SELECTs would return stale data.
  '--caching-disabled')

const res = wrangler(args)
const scrub = s => (s ?? '').split(c.password).join('***')
if (res.status !== 0) {
  console.error(scrub(res.stderr) || scrub(res.stdout))
  process.exit(res.status ?? 1)
}
const id = (res.stdout.match(/"id":\s*"([0-9a-f]{32})"/) ?? res.stdout.match(/\b([0-9a-f]{32})\b/) ?? [])[1]
if (!id) {
  console.log(scrub(res.stdout))
  throw new Error('Could not find the Hyperdrive id in wrangler output')
}
const cfg = readFileSync(CONFIG, 'utf8').replace(/("binding": "HYPERDRIVE",[\s\S]*?"id": ")[0-9a-f]{32}(")/, `$1${id}$2`)
writeFileSync(CONFIG, cfg)
console.log(`Hyperdrive ${update ? 'updated' : 'created'}: ${NAME} (${id}) → wrangler.jsonc`)
