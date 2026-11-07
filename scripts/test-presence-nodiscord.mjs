import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Vérifie qu'un sidecar sans Discord ne plante pas, reste silencieux et s'arrête proprement.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const binary = platform === 'win32'
  ? path.join(root, 'build', 'presence', 'windows-x64', 'discord-presence.exe')
  : platform === 'darwin'
    ? path.join(root, 'build', 'presence', `macos-${arch}`, 'discord-presence')
    : path.join(root, 'build', 'presence', `linux-${arch}`, 'discord-presence')
const temp = await mkdtemp(path.join(os.tmpdir(), 'sapphire3-nodiscord-'))
const missingPipe = platform === 'win32'
  ? `\\\\.\\pipe\\sapphire3-missing-${process.pid}`
  : path.join(temp, 'missing-discord-ipc')

const child = spawn(binary, [String(process.pid)], {
  stdio: ['pipe', 'ignore', 'pipe'],
  env: { ...process.env, SAPPHIRE_DISCORD_IPC_PATH: missingPipe, XDG_RUNTIME_DIR: temp },
})
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

try {
  child.stdin.write(`A${JSON.stringify({ details: 'No Discord', state: 'Still running' })}\n`)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  if (child.exitCode !== null) throw new Error(`le sidecar a quitté sans Discord (code ${child.exitCode})`)
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.stdin.write('Q\n')
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('arrêt trop long')), 5000))])
  console.log('Sans Discord : sidecar stable, silencieux et arrêt propre validés.')
} finally {
  child.stdin.end()
  child.kill()
  await rm(temp, { recursive: true, force: true })
  if (stderr.trim()) console.error(stderr.trim())
}
