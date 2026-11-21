// Reads the repo-root .env (git-ignored) and builds Postgres settings from the Optilogic
// Connection_String. Never prints secret values.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url))

export function loadEnv() {
  const out = {}
  let text
  try {
    text = readFileSync(ENV_PATH, 'utf8')
  } catch {
    throw new Error(`Missing ${ENV_PATH}. Add Connection_String (Optilogic JSON) to the repo-root .env.`)
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

/** Optilogic gives a JSON object: { host, port, dbname, user, password, sslmode }. */
export function pgConfig(env = loadEnv()) {
  const raw = env.OPTILOGIC_CONNECTION_STRING ?? env.Connection_String
  if (!raw) throw new Error('OPTILOGIC_CONNECTION_STRING is not set in .env')
  let c
  if (/^postgres(ql)?:\/\//.test(raw)) {
    const u = new URL(raw)
    c = {
      host: u.hostname, port: u.port || '5432', dbname: decodeURIComponent(u.pathname.slice(1)),
      user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
      sslmode: u.searchParams.get('sslmode') ?? 'require',
    }
  } else {
    try {
      c = JSON.parse(raw)
    } catch {
      throw new Error('OPTILOGIC_CONNECTION_STRING must be Optilogic JSON or a postgresql:// URL')
    }
  }
  for (const k of ['host', 'port', 'dbname', 'user', 'password']) {
    if (!c[k]) throw new Error(`Connection_String is missing "${k}"`)
  }
  return c
}

/** postgresql:// URL form (for Hyperdrive and GitHub Secrets). Password is URL-encoded. */
export function pgUrl(c = pgConfig()) {
  const enc = encodeURIComponent
  return `postgresql://${enc(c.user)}:${enc(c.password)}@${c.host}:${c.port}/${enc(c.dbname)}?sslmode=${c.sslmode ?? 'require'}`
}

/** Options for a node-postgres Client running in Node (scripts). */
export function pgClientOptions(c = pgConfig()) {
  return {
    host: c.host,
    port: Number(c.port),
    database: c.dbname,
    user: c.user,
    password: c.password,
    // Match libpq/Hyperdrive: "require" = encrypted, no certificate check (Optilogic's proxy presents an
    // Azure certificate, so the host name never matches). "verify-ca"/"verify-full" = check it.
    ssl: c.sslmode === 'disable' ? false
      : { rejectUnauthorized: c.sslmode === 'verify-ca' || c.sslmode === 'verify-full' },
    connectionTimeoutMillis: 10_000,
  }
}

// `node scripts/env.mjs --url` writes the URL to stdout (for piping into other commands only).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--url')) {
  process.stdout.write(pgUrl())
}
