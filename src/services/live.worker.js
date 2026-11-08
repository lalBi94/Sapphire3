import { runLiveProgram } from '../utils/logic/liveSimulation.js'

let pendingFrame = null
let stopRequested = false

// Résout la frame en attente avec la réponse du pilote.
function resolveFrame(value) {
  if (!pendingFrame) return
  const resolve = pendingFrame
  pendingFrame = null
  resolve(value)
}

// Exécute le programme en continu et rend la main après chaque tranche.
self.onmessage = async (event) => {
  const data = event.data ?? {}
  if (data.type === 'start') {
    try {
      const result = await runLiveProgram(data.project, {
        inputs: data.inputs ?? {},
        sliceSteps: data.sliceSteps ?? 400,
        onFrame: (state) => new Promise((resolve) => {
          if (stopRequested) {
            resolve({ stop: true })
            return
          }
          pendingFrame = resolve
          self.postMessage({ type: 'frame', state })
        }),
      })
      if (result?.ok === false) self.postMessage({ type: 'error', error: { message: result.error ?? 'Live simulation failed.', code: result.errorCode ?? null } })
      else self.postMessage({ type: 'done', result })
    } catch (error) {
      self.postMessage({ type: 'error', error: { message: error?.message ?? String(error), code: error?.code ?? null } })
    }
    return
  }
  if (data.type === 'tick') {
    resolveFrame({})
    return
  }
  if (data.type === 'response') {
    resolveFrame({ inputs: data.inputs ?? {}, events: data.events ?? [] })
    return
  }
  if (data.type === 'stop') {
    stopRequested = true
    resolveFrame({ stop: true })
  }
}
