import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Vérification Windows de bout en bout : application réelle → sidecar → faux IPC Discord.
if (process.platform !== 'win32') {
  console.log('Test application ignoré : Windows uniquement.')
  process.exit(0)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDirectory = path.join(root, 'build', 'release', 'Sapphire3-0.1.0-beta.6-windows')
const executable = path.join(appDirectory, 'Sapphire3.exe')
const pipePath = `\\\\.\\pipe\\sapphire3-app-test-${process.pid}`
const activities = []

// Liste les sidecars déjà présents pour ne tuer que ceux créés par ce test.
function sidecarPids() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', "Get-Process discord-presence -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"], { encoding: 'utf8' })
  return new Set(String(result.stdout ?? '').split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger))
}

function writeFrame(socket, opcode, payload = '') {
  const body = Buffer.from(payload)
  const header = Buffer.alloc(8)
  header.writeUInt32LE(opcode, 0)
  header.writeUInt32LE(body.length, 4)
  socket.write(Buffer.concat([header, body]))
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 8) {
      const opcode = buffer.readUInt32LE(0)
      const length = buffer.readUInt32LE(4)
      if (buffer.length < 8 + length) break
      const text = buffer.subarray(8, 8 + length).toString()
      buffer = buffer.subarray(8 + length)
      if (opcode === 0) writeFrame(socket, 1, JSON.stringify({ cmd: 'DISPATCH', evt: 'READY', data: {} }))
      else if (opcode === 1) {
        const frame = JSON.parse(text)
        if (frame.cmd === 'SET_ACTIVITY') activities.push(frame.args?.activity ?? null)
      }
    }
  })
})

function waitFor(predicate, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started > timeout) {
        clearInterval(timer)
        reject(new Error('Délai dépassé'))
      }
    }, 100)
  })
}

const existingSidecars = sidecarPids()
let app = null
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(pipePath, resolve)
  })
  app = spawn(executable, [], { cwd: appDirectory, env: { ...process.env, SAPPHIRE_DISCORD_IPC_PATH: pipePath }, stdio: 'ignore' })
  await waitFor(() => activities.length > 0)
  const activity = activities[0]
  if (!activity?.details || !activity?.state) throw new Error('Activité incomplète')
  if (activity.assets?.large_image !== 'sapphire3_logo') throw new Error('Grande image absente')
  if (activity.assets?.large_text !== 'Sapphire 3') throw new Error('Nom absent')
  if (!Number.isInteger(activity.timestamps?.start)) throw new Error('Chronomètre absent')
  if (activity.buttons?.length !== 2) throw new Error('Boutons absents')
  console.log(`Application → sidecar → IPC validé : ${activity.details} / ${activity.state}`)
} finally {
  app?.kill()
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => setTimeout(resolve, 1000))
  for (const pid of sidecarPids()) {
    if (!existingSidecars.has(pid)) spawnSync('taskkill.exe', ['/PID', String(pid), '/F'], { stdio: 'ignore' })
  }
}
