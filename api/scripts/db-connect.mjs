// Connects to the Optilogic Postgres. If the connection fails in a way that looks like the firewall
// (timeout, refused, reset, "not allowed"), it allowlists this machine and the Cloudflare ranges
// with the app key, waits for the firewall to update (up to ~1 minute), and retries.
import pg from 'pg'
import { pgClientOptions } from './env.mjs'
import { allowCloudflare, allowThisMachine } from './firewall.mjs'

const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'])

/** True for errors the firewall causes; false for wrong password, missing database, SQL errors, etc. */
export function looksLikeFirewall(err) {
  if (!err) return false
  if (NETWORK_CODES.has(err.code)) return true
  // Postgres errors carry a 5-character SQLSTATE (e.g. 28P01 bad password): not a firewall problem.
  if (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) return false
  return /timeout|timed out|terminated unexpectedly|connection terminated|not allowed|firewall|no pg_hba/i.test(err.message ?? '')
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function tryConnect() {
  const client = new pg.Client(pgClientOptions())
  try {
    await client.connect()
    return client
  } catch (err) {
    await client.end().catch(() => {})
    throw err
  }
}

/**
 * Returns a connected pg.Client. On a firewall-looking failure: allowlist, then retry every
 * `retryEveryMs` for up to `waitMs` (Optilogic says changes can take a minute).
 */
export async function connectWithAllowlist({ waitMs = 90_000, retryEveryMs = 15_000, allowlist = true } = {}) {
  try {
    return await tryConnect()
  } catch (err) {
    if (!allowlist || !looksLikeFirewall(err)) throw err
    console.warn(`Database connection failed (${err.code ?? err.message}). Updating the Optilogic firewall…`)
  }

  await allowThisMachine()
  await allowCloudflare()

  const deadline = Date.now() + waitMs
  let last
  while (Date.now() < deadline) {
    await sleep(retryEveryMs)
    try {
      const client = await tryConnect()
      console.log('Connected after updating the firewall ✓')
      return client
    } catch (err) {
      last = err
      if (!looksLikeFirewall(err)) throw err
      console.log(`  still blocked, retrying… (${Math.max(0, Math.round((deadline - Date.now()) / 1000))}s left)`)
    }
  }
  throw new Error(`Still can't connect after updating the firewall: ${last?.message ?? 'unknown error'}`)
}
