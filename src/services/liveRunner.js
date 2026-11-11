import { clampSimulationSpeed, liveSpeedDefault, liveTickDelay } from '../utils/simulationSpeed.js'
import { getPluginRuntimePayload } from '../utils/plugins/pluginRuntime.js'

// Pilote un worker live : chaque frame rend la main, puis le worker reprend au tick suivant.
let worker = null
let running = false
let waiting = false
let pendingInputs = null
let pendingEvents = []
let frameCallback = null
let statusCallback = null
let timer = 0
let speed = liveSpeedDefault

// Annule le tick programmé sans changer l'état du worker.
function cancelTick() {
  if (!timer) return
  clearTimeout(timer)
  timer = 0
}

// Envoie le tick suivant après un court délai, y compris quand l'onglet est peu visible.
function scheduleTick() {
  cancelTick()
  if (!running || !worker || !waiting) return
  timer = setTimeout(() => {
    timer = 0
    if (!running || !worker || !waiting) return
    waiting = false
    worker.postMessage({ type: 'tick' })
  }, liveTickDelay(speed))
}

// Envoie les entrées et événements en attente au worker.
function flushResponse() {
  if (!worker) return
  const inputs = pendingInputs ?? {}
  const events = pendingEvents
  pendingInputs = null
  pendingEvents = []
  waiting = false
  worker.postMessage({ type: 'response', inputs, events })
}

// Transmet une frame à l'interface et prépare la reprise ou l'entrée suivante.
function handleFrame(state) {
  waiting = true
  frameCallback?.(state)
  if (pendingInputs || pendingEvents.length > 0) {
    flushResponse()
    return
  }
  scheduleTick()
}

// Démarre un programme live ; une session précédente est arrêtée.
export function startLive(project, { inputs = {}, sliceSteps = 400, speed: initialSpeed = liveSpeedDefault, onFrame = null, onStatus = null } = {}) {
  stopLive()
  if (typeof Worker === 'undefined') {
    onStatus?.({ status: 'error', errorCode: 'LIVE_WORKER_UNAVAILABLE' })
    return false
  }
  speed = clampSimulationSpeed(initialSpeed)
  frameCallback = onFrame
  statusCallback = onStatus
  pendingInputs = null
  pendingEvents = []
  waiting = false
  running = true
  worker = new Worker(new URL('./live.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const data = event.data ?? {}
    if (data.type === 'frame') {
      handleFrame(data.state)
      return
    }
    if (data.type === 'done') {
      running = false
      cancelTick()
      statusCallback?.({ status: data.result?.stopped ? 'stopped' : 'done', result: data.result })
      worker?.terminate()
      worker = null
      return
    }
    if (data.type === 'error') {
      running = false
      cancelTick()
      statusCallback?.({ status: 'error', errorCode: data.error?.code ?? 'SIMULATION_FAILED', error: data.error?.message ?? '' })
      worker?.terminate()
      worker = null
    }
  }
  worker.onerror = (event) => {
    running = false
    cancelTick()
    statusCallback?.({ status: 'error', errorCode: 'SIMULATION_FAILED', error: event?.message ?? 'Live worker failed.' })
    worker?.terminate()
    worker = null
  }
  worker.postMessage({ type: 'start', project, inputs, sliceSteps, plugins: getPluginRuntimePayload() })
  statusCallback?.({ status: 'running' })
  return true
}

// Envoie une nouvelle valeur d'entrée au worker live.
export function sendLiveInputs(inputs) {
  if (!worker) return
  pendingInputs = inputs
  if (waiting) flushResponse()
}

// Envoie des événements de bouton au worker live.
export function sendLiveEvents(events) {
  if (!worker || !Array.isArray(events) || events.length === 0) return
  pendingEvents.push(...events)
  if (waiting) flushResponse()
}

// Modifie la cadence du live sans redémarrer le worker.
export function setLiveSpeed(value) {
  speed = clampSimulationSpeed(value)
  if (running && waiting) scheduleTick()
}

// Suspend la reprise automatique sans terminer le worker.
export function pauseLive() {
  if (!worker) return
  running = false
  cancelTick()
  statusCallback?.({ status: 'paused' })
}

// Reprend la reprise automatique.
export function resumeLive() {
  if (!worker) return
  running = true
  statusCallback?.({ status: 'running' })
  scheduleTick()
}

// Arrête immédiatement la session et libère le worker.
export function stopLive() {
  running = false
  waiting = false
  pendingInputs = null
  pendingEvents = []
  cancelTick()
  if (!worker) return
  const current = worker
  worker = null
  try {
    current.postMessage({ type: 'stop' })
  } catch {
    // Le worker est déjà terminé.
  }
  current.terminate()
  statusCallback?.({ status: 'stopped' })
}
