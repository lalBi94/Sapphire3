import { createDebugSession, simulateProgram } from '../utils/logic/index.js'

let worker = null
let nextRequestId = 0
const pending = new Map()

// Crée le worker à la demande ; un environnement sans Worker garde le repli synchrone.
function ensureWorker() {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker
  worker = new Worker(new URL('./simulation.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const request = pending.get(event.data?.id)
    if (!request) return
    pending.delete(event.data.id)
    if (event.data?.error) request.reject(new Error(event.data.error.message))
    else request.resolve(event.data.session ?? event.data.result)
  }
  worker.onerror = (event) => {
    const failure = new Error(event?.message || 'The simulation worker failed.')
    for (const request of pending.values()) request.reject(failure)
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

// Envoie une demande au worker et attend son résultat sérialisé.
function request(action, project, options) {
  const target = ensureWorker()
  if (!target) return Promise.resolve(action === 'debug' ? createDebugSession(project, options) : simulateProgram(project, options))
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId
    pending.set(id, { resolve, reject })
    try {
      target.postMessage({ id, action, project, options })
    } catch (error) {
      pending.delete(id)
      reject(error)
    }
  })
}

// Lance une simulation hors du fil principal, sans bloquer le rendu React.
export function runSimulation(project, options = {}) {
  return request('simulate', project, options)
}

// Prépare une session de debug hors du fil principal, sans bloquer le rendu React.
export function runDebugSession(project, options = {}) {
  return request('debug', project, options)
}

// Libère le worker lors d'un rechargement à chaud du module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    worker?.terminate()
    worker = null
    pending.clear()
  })
}
