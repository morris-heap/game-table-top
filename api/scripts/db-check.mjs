// Connection check against the Optilogic Postgres in .env. Fixes the firewall if it's blocking us.
import { connectWithAllowlist } from './db-connect.mjs'

let client
try {
  client = await connectWithAllowlist()
  const { rows } = await client.query(
    `select version() as version,
            has_database_privilege(current_database(), 'CREATE') as can_create_schema,
            to_regclass('emberreach.characters') is not null as has_tables`,
  )
  const r = rows[0]
  console.log('Connected ✓')
  console.log(`  server: ${r.version.split(' on ')[0]}`)
  console.log(`  can create schema: ${r.can_create_schema}`)
  console.log(`  emberreach tables: ${r.has_tables ? 'present' : 'missing (run npm run db:migrate)'}`)
} catch (err) {
  console.error('Connection failed:', err.message)
  process.exitCode = 1
} finally {
  await client?.end().catch(() => {})
}
