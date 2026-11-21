// Runs the local wrangler through Node with no shell, so secrets passed as arguments aren't
// rewritten by cmd.exe (which treats ^ & | < > % as special characters).
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const BIN = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
const CWD = fileURLToPath(new URL('..', import.meta.url))

/** Run and capture output. */
export function wranglerSync(args, input) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd: CWD, encoding: 'utf8', input, shell: false })
}

/** Run with inherited output; resolves with the exit code. Optional stdin text. */
export function wranglerRun(args, { input, env } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: CWD, shell: false, env: { ...process.env, ...env },
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    })
    if (input !== undefined) child.stdin.end(input)
    child.on('exit', code => resolve(code ?? 1))
  })
}
