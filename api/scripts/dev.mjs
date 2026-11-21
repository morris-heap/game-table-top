// Runs `wrangler dev` locally, pointing the HYPERDRIVE binding straight at the Optilogic DB from .env.
// Checks the connection first and fixes the firewall if the test environment has dropped our rules.
import { connectWithAllowlist } from './db-connect.mjs'
import { pgUrl } from './env.mjs'
import { wranglerRun } from './wrangler.mjs'

try {
  const client = await connectWithAllowlist()
  await client.end()
} catch (err) {
  console.warn(`Warning: database not reachable yet (${err.message}). Starting the Worker anyway.`)
}

process.exit(await wranglerRun(['dev', ...process.argv.slice(2)], {
  env: { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: pgUrl() },
}))
