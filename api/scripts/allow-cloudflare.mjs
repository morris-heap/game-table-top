// Adds Cloudflare's published IPv4 ranges (and this machine) to the Optilogic database firewall.
// Usage: npm run db:allow-cloudflare [-- --days 365]
// Uses OPTILOGIC_APP_KEY from the repo-root .env. Re-run before the rules expire.
import { allowCloudflare, allowThisMachine } from './firewall.mjs'

const daysArg = process.argv.indexOf('--days')
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 365
if (!Number.isFinite(days) || days <= 0) throw new Error('--days must be a positive number')

const cf = await allowCloudflare({ days })
const me = await allowThisMachine({ days })
console.log(`Expires ${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)}`)
if (cf.ok < cf.total || !me) {
  console.error(`${cf.total - cf.ok + (me ? 0 : 1)} rule(s) failed`)
  process.exitCode = 1
}
