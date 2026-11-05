import { analyzeProgram, createDebugSession, simulateProgram } from '../utils/logic/index.js'
import { transpileProgram } from '../utils/transpilation/index.js'

let worker = null
let nextRequestId = 0
const pending = new Map()

// Identifie une annulation demandée par l'interface, distincte d'une erreur du moteur.
export function engineCancelledError() {
  return Object.assign(new Error('Engine work cancelled.'), { code: 'ENGINE_CANCELLED' })
}

// Reconnaît une annulation sans confondre un diagnostic du moteur avec elle.
export function isEngineCancelled(error) {
  return error?.code === 'ENGINE_CANCELLED'
}

// Termine le worker et rejette toutes les demandes en cours : l'arrêt est immédiat.
function failAll(error) {
  for (const entry of pending.values()) entry.cleanup()
  for (const entry of pending.values()) entry.reject(error)
  pending.clear()
  worker?.terminate()
  worker = null
}

// Annule immédiatement tout calcul du moteur, y compris une analyse ou une simulation.
export function cancelEngineWork() {
  if (pending.size === 0 && !worker) return
  failAll(engineCancelledError())
}

// Crée le worker à la demande ; un environnement sans Worker garde le repli synchrone.
function ensureWorker() {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker
  worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const data = event.data
    const request = pending.get(data?.id)
    if (!request) return
    if (data.progress) {
      request.onProgress?.(data.progress)
      return
    }
    pending.delete(data.id)
    request.cleanup()
    if (data.error) request.reject(Object.assign(new Error(data.error.message), { code: data.error.code ?? null }))
    else request.resolve(Object.hasOwn(data, 'checks') ? data.checks : data.session ?? data.result)
  }
  worker.onerror = (event) => {
    failAll(new Error(event?.message || 'The engine worker failed.'))
  }
  return worker
}

// Exécute une opération hors du fil principal, avec avancement et annulation coopérative par terminaison.
function request(action, project, options, control = {}) {
  const { signal = null, onProgress = null } = control
  if (signal?.aborted) return Promise.reject(engineCancelledError())
  const target = ensureWorker()
  if (!target) {
    try {
      return Promise.resolve(fallback(action, project, options, onProgress, signal))
    } catch (error) {
      return Promise.reject(error)
    }
  }
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId
    const abort = () => failAll(engineCancelledError())
    const cleanup = () => signal?.removeEventListener('abort', abort)
    pending.set(id, { resolve, reject, onProgress, cleanup })
    signal?.addEventListener('abort', abort, { once: true })
    try {
      target.postMessage({ id, action, project, options })
    } catch (error) {
      pending.delete(id)
      cleanup()
      reject(error)
    }
  })
}

// Rejoue l'opération sur le fil courant lorsque les Web Workers ne sont pas disponibles.
function fallback(action, project, options, onProgress, signal) {
  if (signal?.aborted) throw engineCancelledError()
  const withProgress = onProgress ? { ...options, onProgress } : options
  if (action === 'debug') {
    const { project: _project, result: _result, ...session } = createDebugSession(project, withProgress)
    return session
  }
  if (action === 'transpile') {
    const { analysis: _analysis, ...result } = transpileProgram(project, withProgress)
    return result
  }
  if (action === 'check') {
    const targets = Array.isArray(options.targets) ? options.targets : []
    const analysis = analyzeProgram(project, { onProgress })
    return Object.fromEntries(targets.map((target) => [target, transpileProgram(project, { target, analysis }).ok ? 'ok' : 'blocked']))
  }
  return simulateProgram(project, withProgress)
}

// Lance une simulation hors du fil principal, sans bloquer le rendu React.
export function runSimulation(project, options = {}, control = {}) {
  return request('simulate', project, options, control)
}

// Prépare une session de debug hors du fil principal, sans bloquer le rendu React.
export function runDebugSession(project, options = {}, control = {}) {
  return request('debug', project, options, control)
}

// Analyse et génère une cible hors du fil principal, avec annulation possible.
export function runTranspilation(project, options = {}, control = {}) {
  return request('transpile', project, options, control)
}

// Vérifie toutes les cibles installées après une seule analyse, hors du fil principal.
export function runTranspilationChecks(project, targets, control = {}) {
  return request('check', project, { targets }, control)
}

// Libère le worker lors d'un rechargement à chaud du module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    failAll(engineCancelledError())
  })
}
