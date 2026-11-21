// Self-healing for the Optilogic test environment, which sometimes restarts and drops its firewall rules.
// When the Worker can't reach the database, it re-adds Cloudflare's IP ranges with the app key
// (a Worker secret, never sent to browsers). Throttled so failures can't flood the Optilogic API.

const FIREWALL_API = 'https://dev-api.optilogic.app/v0/storages/db-firewall-rule'
const CLOUDFLARE_IPS = 'https://www.cloudflare.com/ips-v4'
const RULE_DAYS = 365
export const THROTTLE_SECONDS = 300
const THROTTLE_KEY = 'https://emberreach-api.internal/firewall-repair'

const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'])

/** True for connection failures the firewall can cause; false for bad passwords and SQL errors. */
export function looksLikeFirewall(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null
  if (!e) return false
  const code = typeof e.code === 'string' ? e.code : ''
  if (NETWORK_CODES.has(code)) return true
  // Postgres SQLSTATE codes (e.g. 28P01 wrong password, 3D000 no database) mean we did reach the server.
  if (/^[0-9A-Z]{5}$/.test(code)) return false
  const msg = typeof e.message === 'string' ? e.message : ''
  return /timeout|timed out|terminated|connection|connect|refused|reset|unreachable|not allowed|firewall|no pg_hba/i.test(msg)
}

export interface RepairResult {
  status: 'repaired' | 'throttled' | 'no-key' | 'failed'
  accepted?: number
  total?: number
}

/** Re-adds Cloudflare's IPv4 ranges to the Optilogic firewall, at most once per THROTTLE_SECONDS. */
export async function repairFirewall(appKey: string | undefined, fetcher: typeof fetch = fetch, cache?: Cache): Promise<RepairResult> {
  if (!appKey) return { status: 'no-key' }

  // Throttle across requests in this location. caches.default isn't shared globally, which is fine.
  const throttle = new Request(THROTTLE_KEY)
  if (cache && (await cache.match(throttle))) return { status: 'throttled' }
  await cache?.put(throttle, new Response('1', { headers: { 'Cache-Control': `max-age=${THROTTLE_SECONDS}` } }))

  try {
    const ranges = (await (await fetcher(CLOUDFLARE_IPS)).text()).split(/\s+/).filter(Boolean)
    const expires = String(Date.now() + RULE_DAYS * 24 * 60 * 60 * 1000)
    const results = await Promise.all(ranges.map(async (cidr, i) => {
      const qs = new URLSearchParams({ name: `cloudflare-${i + 1}`, startIpOrCIDR: cidr, endIp: '', expires })
      const res = await fetcher(`${FIREWALL_API}?${qs}`, { method: 'POST', headers: { 'X-App-Key': appKey } })
      const body = (await res.json().catch(() => ({}))) as { result?: string }
      return res.ok && body.result === 'accepted'
    }))
    const accepted = results.filter(Boolean).length
    console.log(`Firewall repair: ${accepted}/${ranges.length} Cloudflare ranges accepted`)
    return { status: accepted === ranges.length && accepted > 0 ? 'repaired' : 'failed', accepted, total: ranges.length }
  } catch (err) {
    console.error('Firewall repair failed', err)
    return { status: 'failed' }
  }
}
