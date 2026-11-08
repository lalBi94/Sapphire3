// Pilote un worker live : chaque frame rend la main, puis le worker reprend au tick suivant.
let worker = null
let running = false
let waiting = false
let pendingInputs = null
let frameCallback = null
let statusCallback = null
let timer = 0

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
  }, 16)
}

// Transmet une frame à l'interface et prépare la reprise ou l'entrée suivante.
function handleFrame(state) {
  waiting = true
  frameCallback?.(state)
  if (pendingInputs) {
    const inputs = pendingInputs
    pendingInputs = null
    waiting = false
    worker?.postMessage({ type: 'inputs', inputs })
    return
  }
  scheduleTick()
}

// Démarre un programme live ; une session précédente est arrêtée.
export function startLive(project, { inputs = {}, sliceSteps = 400, onFrame = null, onStatus = null } = {}) {
  stopLive()
  if (typeof Worker === 'undefined') {
    onStatus?.({ status: 'error', errorCode: 'LIVE_WORKER_UNAVAILABLE' })
    return false
  }
  frameCallback = onFrame
  statusCallback = onStatus
  pendingInputs = null
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
  worker.postMessage({ type: 'start', project, inputs, sliceSteps })
  statusCallback?.({ status: 'running' })
  return true
}

// Envoie une nouvelle valeur d'entrée au worker live.
export function sendLiveInputs(inputs) {
  if (!worker) return
  pendingInputs = inputs
  if (waiting) {
    const next = pendingInputs
    pendingInputs = null
    waiting = false
    worker.postMessage({ type: 'inputs', inputs: next })
  }
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
