// Optilogic database firewall: add allow rules with the app key from the repo-root .env.
import { loadEnv } from './env.mjs'

const API = 'https://dev-api.optilogic.app/v0/storages/db-firewall-rule'
const DAY_MS = 24 * 60 * 60 * 1000

function appKey() {
  const key = loadEnv().OPTILOGIC_APP_KEY
  if (!key) throw new Error('OPTILOGIC_APP_KEY is not set in .env')
  return key
}

/** Adds (or refreshes) one rule. Returns true if Optilogic accepted it. */
export async function addRule(name, cidr, { days = 365, key = appKey() } = {}) {
  const qs = new URLSearchParams({ name, startIpOrCIDR: cidr, endIp: '', expires: String(Date.now() + days * DAY_MS) })
  const res = await fetch(`${API}?${qs}`, { method: 'POST', headers: { 'X-App-Key': key } })
  const body = await res.json().catch(() => ({}))
  const ok = res.ok && body.result === 'accepted'
  console.log(`  ${ok ? '✓' : '✗'} ${name} ${cidr}${ok ? '' : `  (HTTP ${res.status} ${body.message ?? ''})`}`)
  return ok
}

/** Cloudflare's published IPv4 ranges (used by Hyperdrive to reach the database). */
export async function allowCloudflare({ days = 365 } = {}) {
  const key = appKey()
  const ranges = (await (await fetch('https://www.cloudflare.com/ips-v4')).text()).split(/\s+/).filter(Boolean)
  console.log(`Allowlisting ${ranges.length} Cloudflare ranges for ${days} days`)
  let ok = 0
  for (const [i, cidr] of ranges.entries()) if (await addRule(`cloudflare-${i + 1}`, cidr, { days, key })) ok++
  return { total: ranges.length, ok }
}

/** This machine's public IPv4 address as a /32 rule. */
export async function allowThisMachine({ days = 365 } = {}) {
  const ip = (await (await fetch('https://api.ipify.org')).text()).trim()
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('Could not detect this machine\'s public IP')
  console.log(`Allowlisting this machine (${ip}) for ${days} days`)
  return addRule(`dev-${ip.replaceAll('.', '-')}`, `${ip}/32`, { days })
}
