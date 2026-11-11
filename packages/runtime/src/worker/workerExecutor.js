import { RuntimeError, RUNTIME_ERROR_CODES } from '../errors.js'

// Exécuteur isolé : un Worker par opération, sans état partagé entre runtimes.
export class WorkerExecutor {
  constructor(project, options = {}) {
    this.project = project
    this.options = options
    this.nextId = 0
    this.current = null
  }

  // Crée un Worker compatible web, ou utilise la fabrique fournie.
  createWorker() {
    if (typeof this.options.workerFactory === 'function') {
      try {
        return this.options.workerFactory()
      } catch (error) {
        throw new RuntimeError(RUNTIME_ERROR_CODES.workerFailed, 'The worker factory failed.', { cause: error })
      }
    }
    if (typeof Worker === 'undefined') {
      throw new RuntimeError(RUNTIME_ERROR_CODES.workerUnavailable, 'Web Worker is not available. Use inline isolation or provide workerFactory.')
    }
    try {
      return new Worker(new URL('./runtime.worker.js', import.meta.url), { type: 'module' })
    } catch (error) {
      throw new RuntimeError(RUNTIME_ERROR_CODES.workerUnavailable, 'The runtime worker could not be created.', { cause: error })
    }
  }

  // Termine le worker courant et rejette l'opération en attente.
  dispose() {
    const current = this.current
    this.current = null
    if (!current) return
    try {
      current.reject(new RuntimeError(RUNTIME_ERROR_CODES.disposed, 'This runtime has been disposed.'))
    } catch {
      // Le rejet a déjà été consommé.
    }
    try {
      current.worker.terminate()
    } catch {
      // Le worker est déjà terminé.
    }
  }

  // Exécute une simulation bornée dans un Worker.
  async run({ maxSteps, functionId, args, inputs, signal, onProgress }) {
    if (signal?.aborted) throw new RuntimeError(RUNTIME_ERROR_CODES.cancelled, 'The execution was cancelled before it started.')
    const worker = this.createWorker()
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = () => {
        if (settled) return false
        settled = true
        this.current = null
        try {
          worker.terminate()
        } catch {
          // Le worker est déjà terminé.
        }
        return true
      }
      const fail = (error) => {
        if (!finish()) return
        reject(error)
      }
      const abort = () => fail(new RuntimeError(RUNTIME_ERROR_CODES.cancelled, 'The execution was cancelled.'))
      this.current = { worker, reject: fail }
      worker.onmessage = (event) => {
        const data = event.data ?? {}
        if (data.id !== id) return
        if (data.type === 'progress') {
          onProgress?.(data.progress)
          return
        }
        if (data.type === 'done') {
          if (!finish()) return
          signal?.removeEventListener('abort', abort)
          resolve(data.result)
          return
        }
        if (data.type === 'error') {
          signal?.removeEventListener('abort', abort)
          fail(new RuntimeError(data.error?.code ?? RUNTIME_ERROR_CODES.workerFailed, data.error?.message ?? 'Runtime worker failed.', { details: data.error }))
        }
      }
      worker.onerror = (event) => {
        signal?.removeEventListener('abort', abort)
        fail(new RuntimeError(RUNTIME_ERROR_CODES.workerFailed, event?.message ?? 'Runtime worker failed.'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      try {
        worker.postMessage({ type: 'run', id, project: this.project, options: { maxSteps, functionId, args, inputs } })
      } catch (error) {
        signal?.removeEventListener('abort', abort)
        fail(new RuntimeError(RUNTIME_ERROR_CODES.workerFailed, 'The runtime worker rejected the request.', { cause: error }))
      }
    })
  }

  // Exécute une session live dans un Worker et relaie les frames.
  async startLive({ inputs, sliceSteps, onFrame }) {
    const worker = this.createWorker()
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = () => {
        if (settled) return false
        settled = true
        this.current = null
        try {
          worker.terminate()
        } catch {
          // Le worker est déjà terminé.
        }
        return true
      }
      const fail = (error) => {
        if (!finish()) return
        reject(error)
      }
      this.current = { worker, reject: fail }
      worker.onmessage = async (event) => {
        const data = event.data ?? {}
        if (data.id !== id) return
        if (data.type === 'frame') {
          try {
            const response = await onFrame(data.state)
            if (response?.stop) worker.postMessage({ type: 'stop', id })
            else worker.postMessage({ type: 'advance', id, inputs: response?.inputs ?? {}, events: response?.events ?? [] })
          } catch (error) {
            fail(new RuntimeError(error?.code ?? RUNTIME_ERROR_CODES.executionFailed, error?.message ?? 'Live frame handling failed.', { cause: error }))
          }
          return
        }
        if (data.type === 'done') {
          if (!finish()) return
          resolve(data.result)
          return
        }
        if (data.type === 'error') {
          fail(new RuntimeError(data.error?.code ?? RUNTIME_ERROR_CODES.workerFailed, data.error?.message ?? 'Runtime worker failed.', { details: data.error }))
        }
      }
      worker.onerror = (event) => {
        fail(new RuntimeError(RUNTIME_ERROR_CODES.workerFailed, event?.message ?? 'Runtime worker failed.'))
      }
      try {
        worker.postMessage({ type: 'live', id, project: this.project, options: { inputs, sliceSteps } })
      } catch (error) {
        fail(new RuntimeError(RUNTIME_ERROR_CODES.workerFailed, 'The runtime worker rejected the request.', { cause: error }))
      }
    })
  }
}
