import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const binary = platform === 'win32'
  ? path.join(root, 'build', 'presence', 'windows-x64', 'discord-presence.exe')
  : platform === 'darwin'
    ? path.join(root, 'build', 'presence', `macos-${arch}`, 'discord-presence')
    : path.join(root, 'build', 'presence', `linux-${arch}`, 'discord-presence')

const temp = await mkdtemp(path.join(os.tmpdir(), 'sapphire3-discord-'))
const pipePath = platform === 'win32'
  ? `\\\\.\\pipe\\sapphire3-discord-test-${process.pid}`
  : path.join(temp, 'discord-ipc-test')
const connections = []
let server = null

// Écrit une trame Discord (opcode + longueur little-endian + JSON).
function writeFrame(socket, opcode, payload = '') {
  const body = Buffer.from(payload)
  const header = Buffer.alloc(8)
  header.writeUInt32LE(opcode, 0)
  header.writeUInt32LE(body.length, 4)
  socket.write(Buffer.concat([header, body]))
}

// Lit les trames d'une connexion et répond au handshake par READY.
function handleConnection(socket) {
  const connection = { socket, activities: [], closed: false }
  connections.push(connection)
  let buffer = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 8) {
      const opcode = buffer.readUInt32LE(0)
      const length = buffer.readUInt32LE(4)
      if (buffer.length < 8 + length) break
      const text = buffer.subarray(8, 8 + length).toString()
      buffer = buffer.subarray(8 + length)
      if (opcode === 0) {
        const handshake = JSON.parse(text)
        if (handshake.client_id !== '1568755585250492416') throw new Error(`client_id inattendu : ${handshake.client_id}`)
        writeFrame(socket, 1, JSON.stringify({ cmd: 'DISPATCH', evt: 'READY', data: {} }))
      } else if (opcode === 1) {
        const frame = JSON.parse(text)
        if (frame.cmd === 'SET_ACTIVITY') connection.activities.push(frame)
      }
    }
  })
  socket.on('close', () => { connection.closed = true })
  socket.on('error', () => { connection.closed = true })
}

// Démarre un faux serveur IPC Discord.
function startServer() {
  return new Promise((resolve, reject) => {
    server = net.createServer(handleConnection)
    server.once('error', reject)
    server.listen(pipePath, () => resolve())
  })
}

// Arrête le serveur et attend la libération du pipe/socket.
function stopServer() {
  return new Promise((resolve) => {
    if (!server) return resolve()
    server.close(() => resolve())
    server = null
  })
}

// Attend qu'une condition devienne vraie, sans sleep fixe dans le scénario.
function waitFor(predicate, timeout = 10000) {
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
    }, 50)
  })
}

// Attend une activité SET_ACTIVITY contenant les champs attendus.
function waitForActivity(connection, index, predicate, timeout = 10000) {
  return waitFor(() => connection.activities.length > index && predicate(connection.activities[index]), timeout)
    .then(() => connection.activities[index])
}

const child = spawn(binary, [String(process.pid)], { stdio: ['pipe', 'ignore', 'pipe'], env: { ...process.env, XDG_RUNTIME_DIR: temp, SAPPHIRE_DISCORD_IPC_PATH: pipePath } })
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

try {
  await startServer()
  console.log('ipc: serveur prêt')
  await waitFor(() => connections.length === 1)
  console.log('ipc: première connexion')
  const first = connections[0]
  await waitFor(() => first.activities.length >= 0 && first.socket.readable)
  child.stdin.write(`A${JSON.stringify({ details: 'Test presence', state: 'Ready' })}\n`)
  const activity = await waitForActivity(first, 0, (frame) => frame.args?.activity?.details === 'Test presence')
  console.log('ipc: activité reçue')
  if (activity.args.pid !== process.pid) throw new Error(`pid inattendu : ${activity.args.pid}`)

  // Une activité identique ne doit produire aucune nouvelle trame.
  const countBefore = first.activities.length
  child.stdin.write(`A${JSON.stringify({ details: 'Test presence', state: 'Ready' })}\n`)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  if (first.activities.length !== countBefore) throw new Error('mise à jour redondante envoyée')
  console.log('ipc: déduplication validée')

  // Un vrai changement doit être publié.
  child.stdin.write(`A${JSON.stringify({ details: 'Test presence', state: 'Changed' })}\n`)
  await waitForActivity(first, countBefore, (frame) => frame.args?.activity?.state === 'Changed')
  console.log('ipc: changement reçu')

  // Clear explicite.
  const beforeClear = first.activities.length
  child.stdin.write('C\n')
  await waitForActivity(first, beforeClear, (frame) => frame.args?.activity === null)
  console.log('ipc: clear reçu')

  // Discord redémarre : fermeture du serveur, puis nouvelle écoute et reconnexion.
  first.socket.destroy()
  await stopServer()
  console.log('ipc: serveur arrêté')
  await startServer()
  console.log('ipc: serveur relancé')
  child.stdin.write(`A${JSON.stringify({ details: 'After reconnect', state: 'Back' })}\n`)
  await waitFor(() => connections.length >= 2, 12000)
  console.log('ipc: reconnexion détectée')
  const second = connections[connections.length - 1]
  await waitForActivity(second, 0, (frame) => frame.args?.activity?.details === 'After reconnect', 12000)
  console.log('ipc: activité après reconnexion')

  // Arrêt : Q efface puis quitte.
  const beforeQuit = second.activities.length
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.stdin.write('Q\n')
  await waitFor(() => second.activities.length > beforeQuit && second.activities[beforeQuit].args?.activity === null, 5000)
  await exited
  console.log('IPC Discord : handshake, READY, SET_ACTIVITY, déduplication, clear et reconnexion validés.')
} finally {
  child.stdin.end()
  child.kill()
  await stopServer()
  await rm(temp, { recursive: true, force: true })
  if (stderr.trim()) console.error(stderr.trim())
}
