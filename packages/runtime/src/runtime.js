import { runBounded, runLive } from './engine.js'
import { toRuntimeAnalysis } from './analysis.js'
import { RuntimeError, RUNTIME_ERROR_CODES, toRuntimeError } from './errors.js'
import { loadProjectSync } from './load.js'
import { WorkerExecutor } from './worker/workerExecutor.js'

// Convertit une valeur de retour du moteur en valeur publique stable.
function publicReturnValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value
  if (Array.isArray(value) && value.every((entry) => entry === null || typeof entry === 'string' || typeof entry === 'boolean' || typeof entry === 'number')) return [...value]
  return null
}

// Extrait les états de widgets d'un résultat borné ou d'une frame live.
function widgetsOf(source) {
  return {
    screens: source.screens ?? {},
    gauges: source.gauges ?? {},
    leds: source.leds ?? {},
    rgbLeds: source.rgbLeds ?? {},
    progresses: source.progresses ?? {},
    barCharts: source.barCharts ?? {},
    xyPlots: source.xyPlots ?? {},
    oscilloscopes: source.oscilloscopes ?? {},
    heatmaps: source.heatmaps ?? {},
  }
}

// Extrait les séquences de frames du moteur borné.
function framesOf(result) {
  return {
    screens: result.screenFrames ?? [],
    gauges: result.gaugeFrames ?? [],
    leds: result.ledFrames ?? [],
    rgbLeds: result.rgbLedFrames ?? [],
    progresses: result.progressFrames ?? [],
    barCharts: result.barChartFrames ?? [],
    xyPlots: result.xyPlotFrames ?? [],
    oscilloscopes: result.oscilloscopeFrames ?? [],
    heatmaps: result.heatmapFrames ?? [],
  }
}

// Normalise un résultat de simulation bornée.
function normalizeBoundedResult(result, functionId) {
  const widgets = widgetsOf(result)
  return {
    ok: Boolean(result.ok),
    mode: 'bounded',
    functionId: functionId ?? null,
    output: result.output ?? [],
    outputSteps: result.outputSteps ?? [],
    trace: result.trace ?? [],
    steps: result.steps ?? 0,
    result: publicReturnValue(result.result),
    returnValue: result.returnValue ?? null,
    diagnostics: result.diagnostics ?? [],
    errorCode: result.errorCode ?? null,
    error: result.ok ? null : new RuntimeError(result.errorCode ?? RUNTIME_ERROR_CODES.executionFailed, result.error ?? 'Bounded simulation failed.', { diagnostics: result.diagnostics ?? [] }),
    variables: result.variables ?? [],
    contracts: result.contracts ?? { total: 0, observations: 0, violations: [] },
    widgets,
    frames: framesOf(result),
    ...widgets,
  }
}

// Normalise un résultat live et joint le dernier état de widgets observé.
function normalizeLiveResult(result, gate) {
  const state = gate.state ?? {}
  const widgets = widgetsOf(state)
  return {
    ok: Boolean(result.ok),
    mode: 'live',
    stopped: Boolean(result.stopped),
    output: result.output ?? state.output ?? [],
    steps: result.steps ?? state.steps ?? 0,
    currentNodeId: state.currentNodeId ?? null,
    result: publicReturnValue(result.returned),
    returnValue: result.returnValue ?? null,
    diagnostics: result.diagnostics ?? [],
    errorCode: result.errorCode ?? null,
    error: result.ok ? null : new RuntimeError(result.errorCode ?? RUNTIME_ERROR_CODES.executionFailed, result.error ?? 'Live simulation failed.', { diagnostics: result.diagnostics ?? [] }),
    contracts: result.contracts ?? state.contracts ?? { total: 0, observations: 0, violations: [], active: [] },
    widgets,
    frames: gate.frames,
    state: gate.state,
    ...widgets,
  }
}

// Crée la porte de contrôle d'une session live : pause, reprise, arrêt, entrées et événements.
function createLiveGate(runtime, options = {}) {
  const captureFrames = options.captureFrames === true
  const maximumFrames = Number.isSafeInteger(options.maxFrames) && options.maxFrames > 0 ? options.maxFrames : 240
  let paused = false
  let stopped = false
  let waiting = false
  let resolveFrame = null
  let pendingInputs = null
  let pendingEvents = []
  let state = null
  let status = 'running'
  let outputCount = 0
  const frames = []

  // Prépare la réponse à envoyer au moteur pour la frame courante.
  function takeResponse() {
    const response = {}
    if (pendingInputs) {
      response.inputs = pendingInputs
      pendingInputs = null
    }
    if (pendingEvents.length > 0) {
      response.events = pendingEvents
      pendingEvents = []
    }
    return response
  }

  // Résout la frame en attente, si elle existe.
  function release(response) {
    if (!waiting || !resolveFrame) return
    const resolve = resolveFrame
    waiting = false
    resolveFrame = null
    resolve(response)
  }

  // Reçoit une frame du moteur live et décide de la reprise.
  function onFrame(next) {
    state = next
    runtime.emit('frame', next)
    const output = Array.isArray(next.output) ? next.output : []
    const newLines = output.slice(outputCount)
    outputCount = output.length
    if (newLines.length > 0) runtime.emit('output', { lines: newLines, output })
    if (captureFrames && frames.length < maximumFrames) frames.push(next)
    if (next.done || next.error) {
      status = next.error ? 'error' : 'done'
      return Promise.resolve({})
    }
    return new Promise((resolve) => {
      waiting = true
      resolveFrame = (response) => {
        waiting = false
        resolveFrame = null
        resolve(response)
      }
      if (stopped) {
        release({ stop: true })
        return
      }
      if (!paused) release(takeResponse())
    })
  }

  // Suspend la reprise automatique des frames.
  function pause() {
    if (stopped || status === 'done' || status === 'error' || paused) return false
    paused = true
    status = 'paused'
    runtime.emit('status', { status: 'paused', mode: 'live' })
    return true
  }

  // Reprend la session et applique les entrées ou événements en attente.
  function resume() {
    if (stopped || status === 'done' || status === 'error' || !paused) return false
    paused = false
    status = 'running'
    runtime.emit('status', { status: 'running', mode: 'live' })
    if (waiting) release(takeResponse())
    return true
  }

  // Arrête la session ; l'arrêt effectif a lieu à la prochaine frame.
  function stop() {
    if (stopped || status === 'done' || status === 'error') return false
    stopped = true
    status = 'stopping'
    runtime.emit('status', { status: 'stopping', mode: 'live' })
    if (waiting) release({ stop: true })
    return true
  }

  // Transmet de nouvelles valeurs d'entrée à la frame suivante.
  function sendInputs(inputs) {
    if (stopped || status === 'done' || status === 'error') throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'The live session is no longer running.')
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Inputs must be a plain object keyed by global node id.')
    pendingInputs = { ...(pendingInputs ?? {}), ...inputs }
    if (waiting && !paused) release(takeResponse())
  }

  // Transmet des événements de widgets à la frame suivante.
  function sendEvents(events) {
    if (stopped || status === 'done' || status === 'error') throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'The live session is no longer running.')
    if (!Array.isArray(events)) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Events must be an array.')
    pendingEvents.push(...events)
    if (waiting && !paused) release(takeResponse())
  }

  return {
    onFrame,
    pause,
    resume,
    stop,
    sendInputs,
    sendEvents,
    get state() { return state },
    get status() { return status },
    get frames() { return frames },
  }
}

// Exécuteur dans le fil courant : le moteur reste synchrone et sans worker.
class InlineExecutor {
  constructor(project) {
    this.project = project
  }

  async run({ maxSteps, functionId, args, inputs, onProgress }) {
    return runBounded(this.project, { maxSteps, functionId, args, inputs, onProgress })
  }

  async startLive({ inputs, sliceSteps, onFrame }) {
    return runLive(this.project, { inputs, sliceSteps, onFrame })
  }

  dispose() {}
}

/**
 * Session d'exécution Sapphire indépendante. Chaque instance possède son
 * projet, son analyse, ses écouteurs et son éventuelle session live.
 */
export class SapphireRuntime {
  constructor({ project, analysis, diagnostics, options, executor }) {
    this.project = project
    this.analysis = toRuntimeAnalysis(analysis)
    this.diagnostics = diagnostics
    this.options = options
    this.executor = executor
    this.listeners = new Map()
    this.live = null
    this.active = null
    this.disposed = false
    this.lastStatus = 'idle'
  }

  get canRun() {
    return !this.disposed && this.analysis.canGenerate
  }

  get status() {
    return this.live?.gate.status ?? this.lastStatus
  }

  get state() {
    return this.live?.gate.state ?? null
  }

  // Abonne un écouteur à un événement du runtime.
  on(event, handler) {
    if (this.disposed) throw new RuntimeError(RUNTIME_ERROR_CODES.disposed, 'This runtime has been disposed.')
    if (typeof event !== 'string' || typeof handler !== 'function') throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Expected an event name and a handler function.')
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(handler)
    return () => this.off(event, handler)
  }

  // Retire un écouteur.
  off(event, handler) {
    return this.listeners.get(event)?.delete(handler) ?? false
  }

  // Diffuse un événement sans laisser un écouteur interrompre le moteur.
  emit(event, payload) {
    if (event === 'status' && typeof payload?.status === 'string') this.lastStatus = payload.status
    for (const handler of [...(this.listeners.get(event) ?? [])]) {
      try {
        handler(payload)
      } catch {
        // Un écouteur défaillant ne doit pas corrompre la session.
      }
    }
  }

  // Vérifie que le runtime peut encore exécuter quelque chose.
  assertUsable() {
    if (this.disposed) throw new RuntimeError(RUNTIME_ERROR_CODES.disposed, 'This runtime has been disposed.')
    if (!this.analysis.canGenerate) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The program has blocking diagnostics.', { diagnostics: this.diagnostics })
  }

  // Résout une fonction par identifiant, nom ou objet {id|name, moduleId}.
  resolveFunction(functionRef) {
    const nodes = this.project.nodes
    const findById = (id) => nodes.find((node) => node.id === id && node.kind === 'FunctionDeclaration') ?? null
    const ensureTopLevel = (node) => {
      const module = this.project.modules.find((entry) => entry.id === node.moduleId)
      if (module?.kind === 'class') {
        throw new RuntimeError(RUNTIME_ERROR_CODES.functionUnsupported, 'Direct execution of a class method is not supported. Execute a top-level function or the entry point that uses the class.', { details: { nodeId: node.id, moduleId: node.moduleId } })
      }
      return node.id
    }
    if (typeof functionRef === 'string') {
      const byId = findById(functionRef)
      if (byId) return ensureTopLevel(byId)
      const candidates = this.analysis.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration' && !symbol.importedFrom && symbol.name === functionRef)
      if (candidates.length === 0) {
        const classMethod = nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties?.name === functionRef && this.project.modules.find((module) => module.id === node.moduleId)?.kind === 'class')
        if (classMethod) return ensureTopLevel(classMethod)
        throw new RuntimeError(RUNTIME_ERROR_CODES.functionNotFound, `Unknown function: ${functionRef}.`, { details: { functionRef } })
      }
      if (candidates.length > 1) {
        throw new RuntimeError(RUNTIME_ERROR_CODES.functionAmbiguous, `Function name is ambiguous: ${functionRef}.`, { details: { functionRef, candidates: candidates.map((symbol) => ({ id: symbol.nodeId, name: symbol.name, moduleId: symbol.moduleId })) } })
      }
      const node = findById(candidates[0].nodeId)
      if (!node) throw new RuntimeError(RUNTIME_ERROR_CODES.functionNotFound, `Unknown function: ${functionRef}.`, { details: { functionRef } })
      return ensureTopLevel(node)
    }
    if (functionRef && typeof functionRef === 'object') {
      if (typeof functionRef.id === 'string') {
        const node = findById(functionRef.id)
        if (!node) throw new RuntimeError(RUNTIME_ERROR_CODES.functionNotFound, `Unknown function: ${functionRef.id}.`, { details: { functionRef } })
        return ensureTopLevel(node)
      }
      if (typeof functionRef.name === 'string') {
        const candidates = this.analysis.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration' && !symbol.importedFrom && symbol.name === functionRef.name && (typeof functionRef.moduleId !== 'string' || symbol.moduleId === functionRef.moduleId))
        if (candidates.length === 0) throw new RuntimeError(RUNTIME_ERROR_CODES.functionNotFound, `Unknown function: ${functionRef.name}.`, { details: { functionRef } })
        if (candidates.length > 1) throw new RuntimeError(RUNTIME_ERROR_CODES.functionAmbiguous, `Function name is ambiguous: ${functionRef.name}.`, { details: { functionRef, candidates: candidates.map((symbol) => ({ id: symbol.nodeId, name: symbol.name, moduleId: symbol.moduleId })) } })
        const node = findById(candidates[0].nodeId)
        if (!node) throw new RuntimeError(RUNTIME_ERROR_CODES.functionNotFound, `Unknown function: ${functionRef.name}.`, { details: { functionRef } })
        return ensureTopLevel(node)
      }
    }
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Expected a function id, a function name or { id | name, moduleId }.')
  }

  // Exécute le point d'entrée en mode borné.
  async run(options = {}) {
    return this.executeBounded(null, [], options)
  }

  // Exécute une fonction choisie en mode borné avec des arguments typés.
  async runFunction(functionRef, args = [], options = {}) {
    const functionId = this.resolveFunction(functionRef)
    if (!Array.isArray(args)) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Function arguments must be an array.')
    return this.executeBounded(functionId, args, options)
  }

  // Prépare et exécute une simulation bornée.
  async executeBounded(functionId, args, options) {
    this.assertUsable()
    if (this.active) throw new RuntimeError(RUNTIME_ERROR_CODES.busy, 'This runtime already has an active execution.')
    const maxSteps = options.maxSteps ?? this.options.maxSteps ?? 10000
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidBudget, 'The step budget must be an integer between 1 and 100000.')
    if (options.signal?.aborted) throw new RuntimeError(RUNTIME_ERROR_CODES.cancelled, 'The execution was cancelled before it started.')
    this.active = 'bounded'
    this.emit('status', { status: 'running', mode: 'bounded' })
    try {
      const result = await this.executor.run({
        maxSteps,
        functionId,
        args,
        inputs: options.inputs ?? this.options.inputs ?? {},
        signal: options.signal,
        onProgress: (progress) => this.emit('progress', progress),
      })
      if (options.signal?.aborted) throw new RuntimeError(RUNTIME_ERROR_CODES.cancelled, 'The execution was cancelled.')
      const normalized = normalizeBoundedResult(result, functionId)
      this.active = null
      if (!normalized.ok) this.emit('error', normalized.error)
      if (normalized.output.length > 0) this.emit('output', { lines: normalized.output, output: normalized.output })
      this.emit('status', { status: normalized.ok ? 'done' : 'error', mode: 'bounded', result: normalized })
      this.emit('done', normalized)
      return normalized
    } catch (error) {
      this.active = null
      const runtimeError = toRuntimeError(error)
      this.emit('error', runtimeError)
      this.emit('status', { status: 'error', mode: 'bounded', error: runtimeError })
      throw runtimeError
    }
  }

  // Démarre une session live coopérative et retourne sa promesse de résultat.
  startLive(options = {}) {
    this.assertUsable()
    if (this.active) throw new RuntimeError(RUNTIME_ERROR_CODES.busy, 'This runtime already has an active execution.')
    if (this.live) throw new RuntimeError(RUNTIME_ERROR_CODES.liveActive, 'A live session is already active.')
    const sliceSteps = options.sliceSteps ?? this.options.sliceSteps ?? 400
    if (!Number.isSafeInteger(sliceSteps) || sliceSteps < 1 || sliceSteps > 100000) throw new RuntimeError(RUNTIME_ERROR_CODES.invalidBudget, 'The live slice size must be an integer between 1 and 100000.')
    if (options.signal?.aborted) throw new RuntimeError(RUNTIME_ERROR_CODES.cancelled, 'The execution was cancelled before it started.')
    const gate = createLiveGate(this, options)
    const session = { gate, promise: null }
    this.live = session
    this.active = 'live'
    const abort = () => gate.stop()
    options.signal?.addEventListener('abort', abort, { once: true })
    this.emit('status', { status: 'running', mode: 'live' })
    session.promise = (async () => {
      try {
        const result = await this.executor.startLive({
          inputs: options.inputs ?? this.options.inputs ?? {},
          sliceSteps,
          onFrame: gate.onFrame,
          signal: options.signal,
        })
        this.live = null
        this.active = null
        options.signal?.removeEventListener('abort', abort)
        const normalized = normalizeLiveResult(result, gate)
        if (!normalized.ok) this.emit('error', normalized.error)
        this.emit('status', { status: normalized.ok ? (normalized.stopped ? 'stopped' : 'done') : 'error', mode: 'live', result: normalized })
        this.emit('done', normalized)
        return normalized
      } catch (error) {
        this.live = null
        this.active = null
        options.signal?.removeEventListener('abort', abort)
        const runtimeError = toRuntimeError(error)
        this.emit('error', runtimeError)
        this.emit('status', { status: 'error', mode: 'live', error: runtimeError })
        throw runtimeError
      }
    })()
    // Une session abandonnée ne doit pas produire un rejet non géré.
    session.promise.catch(() => {})
    return session.promise
  }

  // Suspend la reprise automatique de la session live.
  pause() {
    this.assertUsable()
    if (!this.live) throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'No live session is active.')
    return this.live.gate.pause()
  }

  // Reprend la session live.
  resume() {
    this.assertUsable()
    if (!this.live) throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'No live session is active.')
    return this.live.gate.resume()
  }

  // Demande l'arrêt de la session live ; l'arrêt effectif a lieu à la prochaine frame.
  stop() {
    if (this.disposed) throw new RuntimeError(RUNTIME_ERROR_CODES.disposed, 'This runtime has been disposed.')
    if (!this.live) return false
    return this.live.gate.stop()
  }

  // Transmet des valeurs d'entrée à la session live.
  sendInputs(inputs) {
    this.assertUsable()
    if (!this.live) throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'No live session is active.')
    this.live.gate.sendInputs(inputs)
  }

  // Transmet des événements de widgets à la session live.
  sendEvents(events) {
    this.assertUsable()
    if (!this.live) throw new RuntimeError(RUNTIME_ERROR_CODES.notLive, 'No live session is active.')
    this.live.gate.sendEvents(events)
  }

  // Arrête la session éventuelle et libère les ressources du runtime.
  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.live) this.live.gate.stop()
    this.executor.dispose?.()
    this.listeners.clear()
    this.live = null
    this.active = null
    this.lastStatus = 'disposed'
  }
}

// Clone une entrée objet pour isoler le runtime de l'objet de l'appelant.
function cloneInput(input) {
  if (!input || typeof input !== 'object' || input instanceof Uint8Array || input instanceof ArrayBuffer || typeof input.text === 'function') return input
  try {
    return typeof structuredClone === 'function' ? structuredClone(input) : JSON.parse(JSON.stringify(input))
  } catch (error) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The project cannot be cloned for this runtime.', { cause: error })
  }
}

/**
 * Crée une session d'exécution indépendante.
 * @param {object|string|Uint8Array|ArrayBuffer} projectInput Projet logique, workspace, JSON ou octets UTF-8.
 * @param {{maxSteps?: number, sliceSteps?: number, inputs?: object, isolation?: 'inline'|'worker', workerFactory?: Function}} [options]
 * @returns {SapphireRuntime}
 */
export function createRuntime(projectInput, options = {}) {
  const loaded = loadProjectSync(cloneInput(projectInput))
  if (!loaded.canGenerate) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The program has blocking diagnostics.', { diagnostics: loaded.diagnostics })
  }
  if (options.isolation === 'worker' && typeof options.workerFactory !== 'function' && typeof Worker === 'undefined') {
    throw new RuntimeError(RUNTIME_ERROR_CODES.workerUnavailable, 'Web Worker is not available. Use inline isolation or provide workerFactory.')
  }
  const runtimeOptions = { ...options, ...(options.inputs && typeof options.inputs === 'object' ? { inputs: { ...options.inputs } } : {}) }
  const executor = options.isolation === 'worker'
    ? new WorkerExecutor(loaded.project, runtimeOptions)
    : new InlineExecutor(loaded.project)
  return new SapphireRuntime({ ...loaded, options: runtimeOptions, executor })
}
