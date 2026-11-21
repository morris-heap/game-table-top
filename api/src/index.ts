// Cloudflare Worker entry point. Connects to Postgres through Hyperdrive (pooled, near the Worker).
// If the database is unreachable (the Optilogic test environment sometimes restarts and drops its
// firewall rules), the Worker re-adds Cloudflare's IP ranges: on a failed request, and every 10 minutes.
import { Client } from 'pg'
import { repairFirewall, looksLikeFirewall } from './firewall.ts'
import { DatabaseUnavailable, handle } from './handler.ts'
import { PgCharacterStore } from './store.ts'

export interface Env {
  HYPERDRIVE: Hyperdrive
  ALLOWED_ORIGINS: string
  /** Optilogic app key (Worker secret: `wrangler secret put OPTILOGIC_APP_KEY`). Used only for firewall repair. */
  OPTILOGIC_APP_KEY?: string
}

async function connect(env: Env): Promise<Client> {
  // Use Hyperdrive's separate fields: its connectionString doesn't always parse in pg-connection-string.
  // TLS to the real database is handled by Hyperdrive.
  const h = env.HYPERDRIVE
  const client = new Client({ host: h.host, port: h.port, user: h.user, password: h.password, database: h.database })
  try {
    await client.connect()
    return client
  } catch (err) {
    await client.end().catch(() => {})
    throw err
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let client: Client | null = null
    const store = new PgCharacterStore(async () => {
      if (!client) {
        try {
          client = await connect(env)
        } catch (err) {
          console.error('Database connection failed', err)
          if (looksLikeFirewall(err)) ctx.waitUntil(repairFirewall(env.OPTILOGIC_APP_KEY, fetch, caches.default))
          throw new DatabaseUnavailable()
        }
      }
      return client
    })
    try {
      return await handle(request, {
        store,
        allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
      })
    } finally {
      const c = client as Client | null
      if (c) ctx.waitUntil(c.end())
    }
  },

  // Cron (wrangler.jsonc "triggers"): check the database and repair the firewall if it's blocking us,
  // so the site recovers after an Optilogic restart even when nobody is using it.
  async scheduled(_controller, env, ctx): Promise<void> {
    try {
      const client = await connect(env)
      await client.query('select 1')
      ctx.waitUntil(client.end())
    } catch (err) {
      console.error('Scheduled check: database unreachable', err)
      if (looksLikeFirewall(err)) await repairFirewall(env.OPTILOGIC_APP_KEY, fetch, caches.default)
    }
  },
} satisfies ExportedHandler<Env>
