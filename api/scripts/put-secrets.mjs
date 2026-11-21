// Uploads Worker secrets from the repo-root .env without printing them: OPTILOGIC_APP_KEY.
// Requires `npx wrangler login` first.
import { loadEnv } from './env.mjs'
import { wranglerRun } from './wrangler.mjs'

const env = loadEnv()
for (const name of ['OPTILOGIC_APP_KEY']) {
  if (!env[name]) throw new Error(`${name} is not set in .env`)
  const code = await wranglerRun(['secret', 'put', name], { input: env[name] })
  if (code !== 0) throw new Error(`wrangler secret put ${name} exited ${code}`)
}
