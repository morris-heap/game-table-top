import { describe, expect, it } from 'vitest'
import { looksLikeFirewall, repairFirewall } from '../src/firewall.ts'
import { DatabaseUnavailable, handle, type CharacterStore } from '../src/handler.ts'

describe('looksLikeFirewall', () => {
  it.each([
    [{ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' }, true],
    [{ code: 'ECONNREFUSED', message: 'refused' }, true],
    [{ message: 'Connection terminated unexpectedly' }, true],
    [{ message: 'timeout expired' }, true],
    [{ code: '28P01', message: 'password authentication failed' }, false],
    [{ code: '3D000', message: 'database does not exist' }, false],
    [{ code: '42P01', message: 'relation does not exist' }, false],
    [null, false],
  ])('%j → %s', (err, expected) => {
    expect(looksLikeFirewall(err)).toBe(expected)
  })
})

/** Fake fetch: serves the Cloudflare list and records Optilogic calls. */
function fakeFetch(opts: { ranges?: string[]; accept?: boolean } = {}) {
  const ranges = opts.ranges ?? ['173.245.48.0/20', '103.21.244.0/22']
  const calls: { url: string; key: string | null }[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('cloudflare.com/ips-v4')) return new Response(ranges.join('\n'))
    calls.push({ url, key: new Headers(init?.headers).get('X-App-Key') })
    return Response.json({ result: opts.accept === false ? 'rejected' : 'accepted' }, { status: opts.accept === false ? 400 : 200 })
  }) as typeof fetch
  return { fetcher, calls }
}

/** Minimal Cache API stand-in (ignores max-age; good enough to test the throttle). */
function fakeCache(): Cache {
  const m = new Map<string, Response>()
  return {
    match: async (r: RequestInfo | URL) => m.get(String(r instanceof Request ? r.url : r))?.clone(),
    put: async (r: RequestInfo | URL, res: Response) => void m.set(String(r instanceof Request ? r.url : r), res),
  } as unknown as Cache
}

describe('repairFirewall', () => {
  it('does nothing without an app key', async () => {
    const { fetcher, calls } = fakeFetch()
    expect(await repairFirewall(undefined, fetcher)).toEqual({ status: 'no-key' })
    expect(calls).toHaveLength(0)
  })

  it('adds every Cloudflare range with the app key and a one-year expiry', async () => {
    const { fetcher, calls } = fakeFetch()
    const before = Date.now()
    expect(await repairFirewall('op_test', fetcher)).toEqual({ status: 'repaired', accepted: 2, total: 2 })
    expect(calls.map(c => new URL(c.url).searchParams.get('startIpOrCIDR'))).toEqual(['173.245.48.0/20', '103.21.244.0/22'])
    expect(calls.every(c => c.key === 'op_test')).toBe(true)
    const expires = Number(new URL(calls[0].url).searchParams.get('expires'))
    expect(expires - before).toBeGreaterThan(364 * 86_400_000)
  })

  it('reports failure when Optilogic rejects the rules', async () => {
    const { fetcher } = fakeFetch({ accept: false })
    expect((await repairFirewall('op_test', fetcher)).status).toBe('failed')
  })

  it('is throttled: a second failure within 5 minutes makes no calls', async () => {
    const cache = fakeCache()
    const first = fakeFetch()
    expect((await repairFirewall('op_test', first.fetcher, cache)).status).toBe('repaired')
    const second = fakeFetch()
    expect(await repairFirewall('op_test', second.fetcher, cache)).toEqual({ status: 'throttled' })
    expect(second.calls).toHaveLength(0)
  })
})

describe('handler when the database is unreachable', () => {
  it('answers 503 with Retry-After', async () => {
    const down: CharacterStore = {
      ping: async () => { throw new DatabaseUnavailable() },
      list: async () => { throw new DatabaseUnavailable() },
      get: async () => { throw new DatabaseUnavailable() },
      save: async () => { throw new DatabaseUnavailable() },
      delete: async () => { throw new DatabaseUnavailable() },
    }
    const res = await handle(
      new Request('https://api.test/characters', { headers: { 'X-Owner-Id': '11111111-1111-4111-8111-111111111111' } }),
      { store: down, allowedOrigins: [] },
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})
