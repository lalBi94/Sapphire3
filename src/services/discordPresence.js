import { discordActivityKey, discordPreferenceKey, discordPresenceCommand, discordPresencePaths, nextDiscordRetryDelay, parseDiscordPresencePreference } from '../utils/discordPresence.js'
import { readPreference, writePreference } from './preferences.js'

// Un seul sidecar par instance applicative, même avec StrictMode ou plusieurs montages React.
const state = {
  enabled: true,
  stopped: true,
  processId: null,
  client: null,
  starting: null,
  exitHandler: null,
  pageHideHandler: null,
  latest: null,
  lastKey: '',
  startedAt: Math.floor(Date.now() / 1000),
  attempt: 0,
  retryTimer: null,
  stopTimer: null,
}

// Reconnaît la fenêtre desktop ; le mode Vite/web ne tente aucun appel natif.
function desktopAvailable() {
  return typeof window !== 'undefined' && typeof window.NL_TOKEN === 'string' && Boolean(window.NL_PORT)
}

// Charge le client Neutralinojs uniquement dans la fenêtre native.
async function getClient() {
  if (!desktopAvailable()) return null
  if (state.client) return state.client
  try {
    const client = await import('@neutralinojs/lib')
    client.init()
    state.client = client
    return client
  } catch {
    return null
  }
}

// Lit la préférence utilisateur ; Enabled par défaut.
export function readDiscordPresenceEnabled() {
  state.enabled = parseDiscordPresencePreference(readPreference(discordPreferenceKey))
  return state.enabled
}

// Envoie une ligne au sidecar ; un échec programme une reconnexion silencieuse.
async function sendLine(line) {
  if (state.processId === null || !state.client) return false
  try {
    const payload = line.endsWith('\n') ? line : `${line}\n`
    await state.client.os.updateSpawnedProcess(state.processId, 'stdIn', payload)
    return true
  } catch {
    state.processId = null
    scheduleRestart()
    return false
  }
}

// Nettoie le timer de reconnexion courant.
function clearRetry() {
  if (state.retryTimer) {
    clearTimeout(state.retryTimer)
    state.retryTimer = null
  }
}

// Programme une nouvelle tentative avec backoff, sans polling agressif.
function scheduleRestart() {
  if (!state.enabled || state.stopped || state.retryTimer) return
  const delay = nextDiscordRetryDelay(state.attempt)
  state.attempt += 1
  state.retryTimer = setTimeout(() => {
    state.retryTimer = null
    if (state.enabled && !state.stopped) startDiscordPresence()
  }, delay)
}

// Vérifie l'existence d'un sidecar sans le lancer.
async function binaryExists(client, binaryPath) {
  try {
    await client.filesystem.getStats(binaryPath)
    return true
  } catch {
    return false
  }
}

// Vérifie les chemins sur disque puis démarre un seul sidecar existant.
async function spawnSidecar() {
  const client = await getClient()
  if (!client) return { ok: false, reason: 'desktop-required' }
  if (!state.exitHandler) {
    state.exitHandler = (event) => {
      if (event?.detail?.id !== state.processId) return
      if (event.detail.action !== 'exit') return
      state.processId = null
      if (state.enabled && !state.stopped) scheduleRestart()
    }
    client.events.on('spawnedProcess', state.exitHandler)
  }
  const paths = discordPresencePaths(window.NL_OS, window.NL_ARCH, window.NL_PATH)
  if (paths.length === 0) return { ok: false, reason: 'unsupported' }
  for (const binaryPath of paths) {
    if (!(await binaryExists(client, binaryPath))) continue
    const command = discordPresenceCommand(binaryPath, window.NL_PID)
    if (!command) continue
    try {
      const process = await client.os.spawnProcess(command)
      if (!Number.isInteger(process?.id)) continue
      state.processId = process.id
      state.attempt = 0
      if (state.latest) void sendLine(`A${JSON.stringify(state.latest)}`)
      return { ok: true, processId: process.id }
    } catch {
      // Essaie le chemin suivant, sans afficher d'erreur à l'utilisateur.
    }
  }
  scheduleRestart()
  return { ok: false, reason: 'missing' }
}

// Démarre le service si la préférence est active et si l'application est desktop.
export function startDiscordPresence() {
  if (!state.enabled) return Promise.resolve({ ok: false, reason: 'disabled' })
  if (!desktopAvailable()) return Promise.resolve({ ok: false, reason: 'desktop-required' })
  if (state.processId !== null) return Promise.resolve({ ok: true, already: true })
  if (state.starting) return state.starting
  state.stopped = false
  if (state.stopTimer) {
    clearTimeout(state.stopTimer)
    state.stopTimer = null
  }
  if (!state.pageHideHandler) {
    state.pageHideHandler = () => stopDiscordPresence({ immediate: true })
    window.addEventListener('pagehide', state.pageHideHandler)
  }
  state.starting = spawnSidecar().finally(() => { state.starting = null })
  return state.starting
}

// Arrête et efface la présence ; le sidecar reçoit Q puis exit.
export function stopDiscordPresence({ immediate = false } = {}) {
  state.stopped = true
  clearRetry()
  if (state.stopTimer) {
    clearTimeout(state.stopTimer)
    state.stopTimer = null
  }
  const finalize = async () => {
    const client = state.client
    const id = state.processId
    state.processId = null
    state.latest = null
    state.lastKey = ''
    state.attempt = 0
    if (!client || id === null) return
    try { await client.os.updateSpawnedProcess(id, 'stdIn', 'Q\n') } catch { /* déjà arrêté */ }
    try { await client.os.updateSpawnedProcess(id, 'exit') } catch { /* déjà arrêté */ }
  }
  if (immediate) return finalize()
  // Laisse à un remontage React immédiat le temps d'annuler cet arrêt différé.
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null
    void finalize()
  }, 400)
  return Promise.resolve()
}

// Publie une activité seulement si sa signature change ; ajoute le chronomètre de session.
export function updateDiscordPresence(activity) {
  if (!state.enabled || !activity) return { ok: false, reason: 'disabled' }
  const key = discordActivityKey(activity)
  if (key === state.lastKey && state.latest) return { ok: true, unchanged: true }
  state.lastKey = key
  state.latest = { ...activity, timestamps: { start: state.startedAt } }
  if (state.processId !== null) void sendLine(`A${JSON.stringify(state.latest)}`)
  return { ok: true }
}

// Applique immédiatement le réglage et le persiste dans les préférences existantes.
export function setDiscordPresenceEnabled(enabled) {
  state.enabled = Boolean(enabled)
  writePreference(discordPreferenceKey, state.enabled ? 'true' : 'false')
  if (state.enabled) return startDiscordPresence()
  return stopDiscordPresence({ immediate: true })
}

// Réinitialise l'état du singleton entre deux scénarios de test.
export function __resetDiscordPresenceForTests() {
  clearRetry()
  if (state.stopTimer) {
    clearTimeout(state.stopTimer)
    state.stopTimer = null
  }
  state.enabled = true
  state.stopped = true
  state.processId = null
  state.client = null
  state.starting = null
  state.exitHandler = null
  state.pageHideHandler = null
  state.latest = null
  state.lastKey = ''
  state.startedAt = Math.floor(Date.now() / 1000)
  state.attempt = 0
}
