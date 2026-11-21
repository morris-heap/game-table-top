// Applies api/migrations/*.sql in order, once each, tracked in emberreach.schema_migrations.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { connectWithAllowlist } from './db-connect.mjs'

const dir = fileURLToPath(new URL('../migrations/', import.meta.url))
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

let client
try {
  client = await connectWithAllowlist()
  await client.query('create schema if not exists emberreach')
  await client.query(`create table if not exists emberreach.schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`)
  const done = new Set((await client.query('select name from emberreach.schema_migrations')).rows.map(r => r.name))
  let applied = 0
  for (const f of files) {
    if (done.has(f)) continue
    const sql = readFileSync(dir + f, 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into emberreach.schema_migrations (name) values ($1)', [f])
      await client.query('commit')
      console.log(`applied ${f}`)
      applied++
    } catch (err) {
      await client.query('rollback')
      throw new Error(`${f}: ${err.message}`)
    }
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : 'Up to date.')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exitCode = 1
} finally {
  await client?.end().catch(() => {})
}
