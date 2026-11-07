import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findGo } from './build-presence.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(findGo(), ['test', './...'], {
  cwd: path.join(root, 'native', 'discord-presence'),
  stdio: 'inherit',
  env: { ...process.env, CGO_ENABLED: '0' },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
