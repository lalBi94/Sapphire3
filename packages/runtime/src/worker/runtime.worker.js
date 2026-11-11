import { runBounded, runLive } from '../engine.js'

let pendingFrame = null
let stopRequested = false

// Sérialise une erreur pour la frontière du Worker.
function serializeError(error) {
  return {
    code: error?.code ?? 'RUNTIME_WORKER_FAILED',
    message: error?.message ?? 'Runtime worker failed.',
  }
}

// Convertit une valeur de retour en valeur structurable pour postMessage.
function publicValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value
  if (Array.isArray(value) && value.every((entry) => entry === null || typeof entry === 'string' || typeof entry === 'boolean' || typeof entry === 'number')) return [...value]
  return null
}

// Retire du résultat les valeurs internes non structurables (classes, lambdas, pointeurs).
function safeResult(result) {
  if (!result || typeof result !== 'object') return result
  const safe = { ...result }
  if (Object.hasOwn(safe, 'result')) safe.result = publicValue(safe.result)
  if (Object.hasOwn(safe, 'returned')) safe.returned = publicValue(safe.returned)
  return safe
}

// Envoie un résultat ou une erreur au fil principal.
function postDone(id, result) {
  self.postMessage({ type: 'done', id, result: safeResult(result) })
}

// Traite les messages du runtime principal.
self.onmessage = async (event) => {
  const data = event.data ?? {}
  if (data.type === 'run') {
    try {
      const result = runBounded(data.project, data.options)
      postDone(data.id, result)
    } catch (error) {
      self.postMessage({ type: 'error', id: data.id, error: serializeError(error) })
    }
    return
  }
  if (data.type === 'live') {
    pendingFrame = null
    stopRequested = false
    try {
      const result = await runLive(data.project, {
        inputs: data.options?.inputs ?? {},
        sliceSteps: data.options?.sliceSteps ?? 400,
        onFrame: (state) => new Promise((resolve) => {
          if (stopRequested) {
            resolve({ stop: true })
            return
          }
          pendingFrame = resolve
          self.postMessage({ type: 'frame', id: data.id, state })
        }),
      })
      postDone(data.id, result)
    } catch (error) {
      self.postMessage({ type: 'error', id: data.id, error: serializeError(error) })
    }
    return
  }
  if (data.type === 'advance') {
    const resolve = pendingFrame
    pendingFrame = null
    resolve?.({ inputs: data.inputs ?? {}, events: data.events ?? [] })
    return
  }
  if (data.type === 'stop') {
    stopRequested = true
    const resolve = pendingFrame
    pendingFrame = null
    resolve?.({ stop: true })
  }
}
