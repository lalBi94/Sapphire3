import { createDebugSession as createEngineDebugSession, moveDebugSession, resolveDebugScreens } from '../../../src/utils/logic/debugging.js'
import { DEBUG_ERROR_CODES, DebugError, assertFrameIndex, assertId, assertProject } from './errors.js'

/** Événements publics émis par une session. `*` écoute tous les événements. */
export const DEBUG_EVENT_TYPES = Object.freeze([
  'created',
  'position',
  'stop',
  'breakpoint',
  'resume',
  'error',
  'finished',
  'restart',
  'breakpoints',
  'disposed',
])

/** Raisons stables du dernier arrêt. */
export const DEBUG_STOP_REASONS = Object.freeze({
  initial: 'initial',
  stepInto: 'step-into',
  stepNext: 'step-next',
  stepOut: 'step-out',
  stepOutScope: 'step-out-scope',
  continue: 'continue',
  stepBack: 'step-back',
  restart: 'restart',
  breakpoint: 'breakpoint',
  end: 'end',
  error: 'error',
})

const MAX_INSTRUCTION_LIMIT = 1000
const MAX_EXPORT_FRAMES = 10000
const MAX_EXPORT_OUTPUT = 10000
const EMPTY_ARRAY = Object.freeze([])
const EMPTY_OBJECT = Object.freeze({})
const EMPTY_WIDGETS = Object.freeze({
  gauges: EMPTY_OBJECT,
  leds: EMPTY_OBJECT,
  rgbLeds: EMPTY_OBJECT,
  progresses: EMPTY_OBJECT,
  barCharts: EMPTY_OBJECT,
  xyPlots: EMPTY_OBJECT,
  oscilloscopes: EMPTY_OBJECT,
  heatmaps: EMPTY_OBJECT,
})
const EMPTY_REACHABILITY = Object.freeze({
  ok: false,
  reachableNodeIds: EMPTY_ARRAY,
  unreachableNodeIds: EMPTY_ARRAY,
  functions: EMPTY_ARRAY,
})
const EMPTY_REACHABILITY_SUMMARY = Object.freeze({
  ok: false,
  reachableCount: 0,
  unreachableCount: 0,
  functionCount: 0,
})

let sessionSequence = 0

// Crée un identifiant de session stable, sans dépendre du réseau ni du disque.
function createSessionId() {
  sessionSequence += 1
  if (typeof globalThis.crypto?.randomUUID === 'function') return `debug-${globalThis.crypto.randomUUID()}`
  return `debug-${Date.now().toString(36)}-${sessionSequence.toString(36)}`
}

// Reconnaît un objet simple, sans prototype exotique.
function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// Copie une source JSON sans partager les objets mutables avec l'appelant.
function cloneValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const copy = []
    seen.set(value, copy)
    for (const entry of value) copy.push(cloneValue(entry, seen))
    return copy
  }
  const copy = {}
  seen.set(value, copy)
  for (const [key, entry] of Object.entries(value)) copy[key] = cloneValue(entry, seen)
  return copy
}

// Gèle récursivement une valeur simple pour garantir un accès en lecture seule.
function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value) || isPlainObject(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key], seen)
    Object.freeze(value)
  }
  return value
}

// Distingue les activations de fonction et de lambda des blocs et des boucles.
function isCallableScope(scopeId) {
  return typeof scopeId === 'string' && (scopeId.startsWith('function:') || scopeId.startsWith('lambda:'))
}

// Extrait les états de widgets non-écran d'une frame.
function widgetsOf(frame) {
  return Object.freeze({
    gauges: frame?.gauges ?? EMPTY_OBJECT,
    leds: frame?.leds ?? EMPTY_OBJECT,
    rgbLeds: frame?.rgbLeds ?? EMPTY_OBJECT,
    progresses: frame?.progresses ?? EMPTY_OBJECT,
    barCharts: frame?.barCharts ?? EMPTY_OBJECT,
    xyPlots: frame?.xyPlots ?? EMPTY_OBJECT,
    oscilloscopes: frame?.oscilloscopes ?? EMPTY_OBJECT,
    heatmaps: frame?.heatmaps ?? EMPTY_OBJECT,
  })
}

// Décrit un nœud source sans recopier ses enfants ni ses propriétés volumineuses.
function describeNode(node) {
  return Object.freeze({
    id: node.id,
    kind: node.kind,
    moduleId: node.moduleId,
    name: node.properties?.name ?? null,
    type: node.properties?.type ?? null,
    entryPoint: node.properties?.entryPoint === true,
    constructor: node.properties?.constructor === true,
    visibility: node.properties?.visibility ?? null,
  })
}

// Décrit un module source sans exposer ses collections mutables.
function describeModule(module) {
  return Object.freeze({ id: module.id, name: module.name, kind: module.kind })
}

// Décrit une classe source.
function describeClass(module) {
  return Object.freeze({ id: module.id, name: module.name })
}

// Vérifie et normalise les options de session.
function normalizeOptions(options) {
  if (options === undefined || options === null) return {}
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected a session options object.')
  }
  if (options.maxSteps !== undefined && (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1 || options.maxSteps > 100000)) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected maxSteps to be an integer between 1 and 100000.', { details: { maxSteps: options.maxSteps } })
  }
  if (options.onProgress !== undefined && typeof options.onProgress !== 'function') {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected onProgress to be a function.')
  }
  if (options.onEvent !== undefined && typeof options.onEvent !== 'function') {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected onEvent to be a function.')
  }
  return { ...options }
}

// Vérifie qu'un identifiant de nœud existe dans la source.
function assertBreakpointNode(project, nodeId) {
  assertId(nodeId, 'node id')
  if (!project.nodes.some((node) => node?.id === nodeId)) {
    throw new DebugError(DEBUG_ERROR_CODES.unknownNode, `Unknown node id: ${nodeId}.`, { details: { nodeId } })
  }
  return nodeId
}

// Normalise une collection de points d'arrêt en liste triée et validée.
function normalizeBreakpoints(project, value) {
  if (value === undefined || value === null) return []
  const values = value instanceof Set ? [...value] : Array.isArray(value) ? value : null
  if (!values) throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected breakpoints as an array or a Set of node ids.')
  const result = new Set()
  for (const nodeId of values) result.add(assertBreakpointNode(project, nodeId))
  return [...result].sort()
}

// Compare deux ensembles de points d'arrêt.
function sameSet(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

// Valide un type d'événement public.
function assertEventType(type) {
  if (typeof type !== 'string' || (type !== '*' && !DEBUG_EVENT_TYPES.includes(type))) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, `Unknown debug event type: ${String(type)}.`, { details: { type } })
  }
  return type
}

// Valide une option entière bornée.
function integerOption(value, fallback, minimum, maximum, label) {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, `Expected ${label} to be an integer between ${minimum} and ${maximum}.`, { details: { [label]: value } })
  }
  return value
}

/**
 * Session de débogage fondée sur une trace enregistrée.
 *
 * La session ne suspend jamais un interpréteur : toutes les positions et tous
 * les états proviennent des frames calculées à la création. Les valeurs sont
 * gelées et JSON-sérialisables.
 */
export class DebugSession {
  /**
   * @param {object} project Projet source Sapphire 3.
   * @param {object} [options] `maxSteps`, `breakpoints`, `functionId`, `args`, `inputs`, `onProgress`, `onEvent`.
   */
  constructor(project, options = {}) {
    assertProject(project)
    const normalized = normalizeOptions(options)
    const breakpointList = normalizeBreakpoints(project, normalized.breakpoints)
    const ownedProject = deepFreeze(cloneValue(project))
    const { onEvent: externalListener = null, breakpoints: _breakpoints, ...engineOptions } = normalized
    let engineSession
    try {
      engineSession = createEngineDebugSession(ownedProject, { ...engineOptions, breakpoints: new Set(breakpointList) })
    } catch (error) {
      if (error instanceof DebugError) throw error
      throw new DebugError(DEBUG_ERROR_CODES.internal, 'Unable to create the debug session.', { cause: error })
    }

    const frames = Array.isArray(engineSession.frames) ? engineSession.frames : []
    deepFreeze(frames)
    const reachability = deepFreeze(engineSession.reachability ?? { ...EMPTY_REACHABILITY })
    const diagnostics = deepFreeze(Array.isArray(engineSession.diagnostics) ? engineSession.diagnostics : [])
    const result = engineSession.result ?? null
    const { project: _project, result: _result, frames: _frames, reachability: _reachability, diagnostics: _diagnostics, ...rest } = engineSession

    Object.defineProperty(this, 'id', { value: createSessionId(), enumerable: true, writable: false })
    this._project = ownedProject
    this._frames = frames
    this._reachability = reachability
    this._diagnostics = diagnostics
    this._sessionError = result?.error ?? null
    this._sessionErrorCode = engineSession.errorCode ?? null
    this._nodeById = new Map(ownedProject.nodes.filter((node) => typeof node?.id === 'string').map((node) => [node.id, node]))
    this._moduleById = new Map(ownedProject.modules.filter((module) => typeof module?.id === 'string').map((module) => [module.id, module]))
    this._breakpoints = new Set(breakpointList)
    this._breakpointList = Object.freeze([...breakpointList])
    this._engineSession = {
      ...rest,
      project: ownedProject,
      frames,
      reachability,
      diagnostics,
      breakpoints: this._breakpoints,
    }
    Object.freeze(this._engineSession.history)
    this._listeners = new Map()
    this._externalListener = externalListener
    this._sequence = 0
    this._disposed = false
    this._createdAt = new Date().toISOString()
    this._lastStopReason = frames.length === 0 ? DEBUG_STOP_REASONS.error : DEBUG_STOP_REASONS.initial
    this._instructionFrameIndices = []
    this._instructionCountAtFrame = []
    this._scopeKindByInstance = new Map()
    this._nodeIdByInstance = new Map()
    this._hasScreens = false
    this._traceErrorCode = null
    this._indexFrames()
    if (frames.length > 0 && this.terminal) this._lastStopReason = this.status === 'error' ? DEBUG_STOP_REASONS.error : DEBUG_STOP_REASONS.end

    this._emit('created', {
      frameCount: frames.length,
      nodeId: this._currentFrame()?.nodeId ?? null,
      status: this.status,
      lastStopReason: this._lastStopReason,
      errorCode: this.errorCode,
      diagnosticCount: diagnostics.length,
      traceErrorCode: this._traceErrorCode,
    })
    if (frames.length === 0) {
      this._emit('error', {
        errorCode: this._sessionErrorCode,
        message: this._sessionError ?? 'The debug session could not start.',
        diagnostics,
        reason: DEBUG_STOP_REASONS.error,
      })
      this._emit('finished', { ok: false, reason: DEBUG_STOP_REASONS.error, cursor: null, errorCode: this._sessionErrorCode, outputLength: 0 })
    } else if (this.terminal) {
      if (this.status === 'error') {
        this._emit('error', {
          errorCode: this.errorCode,
          message: this.error ?? 'Simulation stopped.',
          diagnostics,
          reason: DEBUG_STOP_REASONS.error,
        })
      }
      this._emit('finished', { ok: this.status !== 'error', reason: this._lastStopReason, cursor: this.cursor, errorCode: this.errorCode, outputLength: this._currentFrame()?.output?.length ?? 0 })
    }
  }

  /** Identifiant de session, stable et unique dans le processus. */
  get sessionId() {
    return this.id
  }

  /** Indique si la session a libéré ses références. */
  get disposed() {
    return this._disposed
  }

  /** Nombre total de frames enregistrées. */
  get frameCount() {
    return this._frames.length
  }

  /** Index de la frame courante, ou null après disposition ou source invalide. */
  get cursor() {
    if (this._disposed || this._frames.length === 0) return null
    return this._engineSession?.cursor ?? null
  }

  /** Statut courant : paused, completed, error, invalid ou disposed. */
  get status() {
    if (this._disposed) return 'disposed'
    if (this._frames.length === 0) return 'invalid'
    const frame = this._frames[this._engineSession?.cursor]
    if (!frame) return 'invalid'
    return frame.status === 'paused' ? 'paused' : frame.status
  }

  /** Raison stable du dernier arrêt. */
  get lastStopReason() {
    return this._lastStopReason
  }

  /** Points d'arrêt actifs, triés. */
  get breakpoints() {
    return this._breakpointList
  }

  /** Code d'erreur de la frame courante ou de la création de session. */
  get errorCode() {
    if (this._disposed) return null
    if (this._frames.length === 0) return this._sessionErrorCode
    return this._frames[this._engineSession?.cursor]?.errorCode ?? null
  }

  /** Message d'erreur associé au code courant, ou null. */
  get error() {
    if (this._disposed) return null
    if (this._frames.length === 0) return this._sessionError
    return this.errorCode ? this._sessionError ?? 'Simulation stopped.' : null
  }

  /** Indique si la trace est terminée, en erreur ou invalide. */
  get terminal() {
    if (this._disposed || this._frames.length === 0) return true
    const cursor = this._engineSession?.cursor ?? 0
    if (cursor >= this._frames.length - 1) return true
    return this._frames[cursor]?.status !== 'paused'
  }

  /** Indique si un retour arrière est possible. */
  get canStepBack() {
    return !this._disposed && (this._engineSession?.history?.length ?? 0) > 0
  }

  /** Indique si une frame suivante peut être atteinte. */
  get canStepInto() {
    return !this._disposed && this._frames.length > 0 && !this.terminal
  }

  /** Indique si un pas par-dessus peut être exécuté. */
  get canStepNext() {
    return this.canStepInto
  }

  /** Indique si la fonction courante peut être quittée. */
  get canStepOut() {
    return this.canStepInto && this._callDepth(this._currentFrame()) > 0
  }

  /** Indique si le scope lexical courant peut être quitté. */
  get canStepOutScope() {
    return this.canStepInto
  }

  /** Indique si la reprise jusqu'au prochain arrêt est possible. */
  get canContinue() {
    return this.canStepInto
  }

  /** Indique si le redémarrage changerait la position. */
  get canRestart() {
    return !this._disposed && this._frames.length > 0 && (this.cursor !== 0 || (this._engineSession?.history?.length ?? 0) > 0)
  }

  // Indexe les instructions exécutées et les écrans disponibles une seule fois.
  _indexFrames() {
    let count = 0
    for (let index = 0; index < this._frames.length; index += 1) {
      const frame = this._frames[index]
      for (const scope of frame?.localScopes ?? EMPTY_ARRAY) {
        this._scopeKindByInstance.set(scope.instanceId, scope.scopeId)
        this._nodeIdByInstance.set(scope.instanceId, scope.nodeId)
      }
      for (const entry of frame?.callStack ?? EMPTY_ARRAY) {
        if (!this._scopeKindByInstance.has(entry.instanceId)) this._scopeKindByInstance.set(entry.instanceId, `function:${entry.nodeId}`)
        this._nodeIdByInstance.set(entry.instanceId, entry.nodeId)
      }
      if (frame?.nodeId !== null && frame?.nodeId !== undefined) {
        this._instructionFrameIndices.push(index)
        count += 1
      }
      this._instructionCountAtFrame[index] = count
      if (frame?.screenBase || frame?.screenPatch) this._hasScreens = true
      if (this._traceErrorCode === null && frame?.status === 'error') this._traceErrorCode = frame.errorCode ?? null
    }
    Object.freeze(this._instructionFrameIndices)
    Object.freeze(this._instructionCountAtFrame)
  }

  // Compte les activations de fonction et de lambda réellement actives.
  _callDepth(frame) {
    if (!frame) return 0
    let depth = 0
    for (const instanceId of frame.scopeIds ?? EMPTY_ARRAY) {
      if (isCallableScope(this._scopeKindByInstance.get(instanceId))) depth += 1
    }
    return depth
  }

  // Retourne la frame courante, ou null si la session est vide.
  _currentFrame() {
    return this._frames[this._engineSession?.cursor ?? -1] ?? null
  }

  // Construit la pile des fonctions et lambdas actifs, de l'extérieur vers l'intérieur.
  _callStack(frame) {
    const callables = []
    for (const instanceId of frame?.scopeIds ?? EMPTY_ARRAY) {
      const scopeId = this._scopeKindByInstance.get(instanceId)
      if (!isCallableScope(scopeId)) continue
      callables.push({ instanceId, scopeId, nodeId: this._nodeIdByInstance.get(instanceId) ?? null })
    }
    return Object.freeze(callables.map((scope, index) => this._describeCallable(scope, index + 1)))
  }

  // Décrit une activation de fonction, de méthode ou de lambda.
  _describeCallable(scope, depth) {
    const node = this._nodeById.get(scope.nodeId) ?? null
    const module = node ? this._moduleById.get(node.moduleId) ?? null : null
    const isLambda = scope.scopeId.startsWith('lambda:')
    return Object.freeze({
      depth,
      instanceId: scope.instanceId,
      scopeId: scope.scopeId,
      nodeId: scope.nodeId,
      kind: node?.kind ?? (isLambda ? 'LambdaExpression' : 'FunctionDeclaration'),
      name: node?.properties?.name ?? (isLambda ? '<lambda>' : scope.scopeId),
      moduleId: node?.moduleId ?? null,
      moduleName: module?.name ?? null,
      classId: module?.kind === 'class' ? module.id : null,
      className: module?.kind === 'class' ? module.name : null,
      isLambda,
      entryPoint: node?.properties?.entryPoint === true,
    })
  }

  // Décrit les portées locales avec leur activation et leur fonction porteuse.
  _scopes(frame) {
    const localScopes = frame?.localScopes ?? EMPTY_ARRAY
    const scopes = localScopes.map((scope, index) => {
      const node = this._nodeById.get(scope.nodeId) ?? null
      const nearestCallable = localScopes.slice(index).find((entry) => isCallableScope(entry.scopeId)) ?? null
      return Object.freeze({
        instanceId: scope.instanceId,
        nodeId: scope.nodeId,
        scopeId: scope.scopeId,
        kind: scope.scopeId.split(':')[0],
        nodeKind: node?.kind ?? null,
        name: node?.properties?.name ?? scope.scopeId,
        moduleId: node?.moduleId ?? null,
        callableNodeId: nearestCallable?.nodeId ?? null,
        variables: scope.variables ?? EMPTY_ARRAY,
      })
    })
    return Object.freeze(scopes)
  }

  // Aplatit les variables locales en conservant leur portée et leur nature.
  _locals(frame, scopes) {
    const entries = []
    for (let index = 0; index < (frame?.localScopes?.length ?? 0); index += 1) {
      const scope = frame.localScopes[index]
      const scopeInfo = scopes[index]
      for (const variable of scope.variables ?? EMPTY_ARRAY) {
        const node = this._nodeById.get(variable.nodeId) ?? null
        entries.push(Object.freeze({
          ...variable,
          kind: node?.kind ?? null,
          scopeId: scope.scopeId,
          instanceId: scope.instanceId,
          scopeKind: scopeInfo.kind,
          callableNodeId: scopeInfo.callableNodeId,
        }))
      }
    }
    return Object.freeze(entries)
  }

  // Résume l'accessibilité sans recopier les listes complètes.
  _reachabilitySummary() {
    const reachability = this._reachability
    return Object.freeze({
      ok: reachability?.ok === true,
      reachableCount: reachability?.reachableNodeIds?.length ?? 0,
      unreachableCount: reachability?.unreachableNodeIds?.length ?? 0,
      functionCount: reachability?.functions?.length ?? 0,
    })
  }

  // Retourne la première frame d'un intervalle qui porte un point d'arrêt.
  _firstBreakpoint(start, end) {
    if (this._breakpoints.size === 0) return null
    const limit = Math.min(end, this._frames.length - 1)
    for (let index = Math.max(start, 0); index <= limit; index += 1) {
      const nodeId = this._frames[index]?.nodeId
      if (nodeId && this._breakpoints.has(nodeId)) return index
    }
    return null
  }

  // Déplace le curseur d'une frame et empile l'ancienne position.
  _setCursor(target) {
    const previous = this._engineSession.cursor
    this._engineSession = {
      ...this._engineSession,
      cursor: target,
      history: [...this._engineSession.history, previous],
      breakpoints: this._breakpoints,
    }
  }

  // Applique une commande native du moteur et signale les non-déplacements.
  _moveEngine(action) {
    const next = moveDebugSession(this._engineSession, action, { breakpoints: this._breakpoints })
    if (next === this._engineSession) return false
    this._engineSession = { ...next, breakpoints: this._breakpoints }
    return true
  }

  // Publie les événements d'un déplacement et retourne l'état courant.
  _finishMove({ action, baseReason, previousCursor, breakpointNodeId = null, resume = true }) {
    Object.freeze(this._engineSession.history)
    const frame = this._currentFrame()
    const terminal = this.terminal
    const reason = terminal
      ? (frame?.status === 'error' ? DEBUG_STOP_REASONS.error : DEBUG_STOP_REASONS.end)
      : breakpointNodeId ? DEBUG_STOP_REASONS.breakpoint : baseReason
    this._lastStopReason = reason
    if (resume) this._emit('resume', { action, from: previousCursor, to: this.cursor })
    const nodeId = frame?.nodeId ?? null
    const status = this.status
    this._emit('position', { previousCursor, cursor: this.cursor, nodeId, status, reason, terminal })
    this._emit('stop', { reason, cursor: this.cursor, nodeId, status, terminal, errorCode: frame?.errorCode ?? null })
    if (breakpointNodeId) this._emit('breakpoint', { nodeId: breakpointNodeId, cursor: this.cursor, source: action })
    if (terminal) {
      if (frame?.status === 'error') {
        this._emit('error', {
          errorCode: frame.errorCode ?? this._sessionErrorCode,
          message: this._sessionError ?? 'Simulation stopped.',
          diagnostics: this._diagnostics,
          reason,
        })
      }
      this._emit('finished', { ok: frame?.status !== 'error', reason, cursor: this.cursor, errorCode: frame?.errorCode ?? null, outputLength: frame?.output?.length ?? 0 })
    }
    return this.state()
  }

  // Vérifie que la session n'a pas été libérée.
  _assertActive() {
    if (this._disposed) throw new DebugError(DEBUG_ERROR_CODES.disposed, 'The debug session has been disposed.')
  }

  // Notifie les abonnés et l'écouteur optionnel sans propager leurs erreurs.
  _emit(type, payload = {}) {
    const event = Object.freeze({
      type,
      sessionId: this.id,
      sequence: (this._sequence += 1),
      timestamp: Date.now(),
      ...payload,
    })
    this._notify(type, event)
    if (type !== '*') this._notify('*', event)
    if (this._externalListener) {
      try {
        this._externalListener(event)
      } catch {
        // Un écouteur ne doit jamais interrompre la session de débogage.
      }
    }
  }

  // Appelle une copie des abonnés d'un type.
  _notify(type, event) {
    const listeners = this._listeners.get(type)
    if (!listeners) return
    for (const listener of [...listeners]) {
      try {
        listener(event)
      } catch {
        // Un écouteur ne doit jamais interrompre la session de débogage.
      }
    }
  }

  /**
   * Retourne un instantané JSON-sérialisable et gelé de la position courante.
   * Les écrans complets restent disponibles via `getScreens()`.
   */
  state() {
    if (this._disposed) return this._disposedState()
    if (this._frames.length === 0) return this._invalidState()
    const frame = this._currentFrame()
    if (!frame) return this._invalidState()
    const callStack = this._callStack(frame)
    const scopes = this._scopes(frame)
    const locals = this._locals(frame, scopes)
    const currentFunction = callStack.at(-1) ?? null
    const parameters = Object.freeze(currentFunction ? locals.filter((entry) => entry.kind === 'Parameter' && entry.scopeId === currentFunction.scopeId) : [])
    const node = frame.nodeId ? this._nodeById.get(frame.nodeId) ?? null : null
    const module = node ? this._moduleById.get(node.moduleId) ?? null : null
    const state = {
      sessionId: this.id,
      disposed: false,
      status: this.status,
      cursor: this.cursor,
      frameCount: this._frames.length,
      nodeId: frame.nodeId ?? null,
      currentNode: node ? describeNode(node) : null,
      currentModule: module ? describeModule(module) : null,
      currentClass: module?.kind === 'class' ? describeClass(module) : null,
      currentFunction,
      callStack,
      scopes,
      globals: frame.globals ?? EMPTY_ARRAY,
      locals,
      parameters,
      output: frame.output ?? EMPTY_ARRAY,
      widgets: widgetsOf(frame),
      screens: null,
      hasScreens: this._hasScreens,
      instructionCount: this._instructionCountAtFrame[this._engineSession.cursor] ?? 0,
      navigationHistory: this._engineSession.history,
      breakpoints: this._breakpointList,
      diagnostics: this._diagnostics,
      reachability: this._reachabilitySummary(),
      lastStopReason: this._lastStopReason,
      errorCode: this.errorCode,
      error: this.error,
      terminal: this.terminal,
      canStepBack: this.canStepBack,
      canStepInto: this.canStepInto,
      canStepNext: this.canStepNext,
      canStepOut: this.canStepOut,
      canStepOutScope: this.canStepOutScope,
      canContinue: this.canContinue,
      canRestart: this.canRestart,
      createdAt: this._createdAt,
    }
    return Object.freeze(state)
  }

  // État minimal d'une source invalide, sans frame exploitable.
  _invalidState() {
    return Object.freeze({
      sessionId: this.id,
      disposed: false,
      status: 'invalid',
      cursor: null,
      frameCount: 0,
      nodeId: null,
      currentNode: null,
      currentModule: null,
      currentClass: null,
      currentFunction: null,
      callStack: EMPTY_ARRAY,
      scopes: EMPTY_ARRAY,
      globals: EMPTY_ARRAY,
      locals: EMPTY_ARRAY,
      parameters: EMPTY_ARRAY,
      output: EMPTY_ARRAY,
      widgets: EMPTY_WIDGETS,
      screens: null,
      hasScreens: false,
      instructionCount: 0,
      navigationHistory: EMPTY_ARRAY,
      breakpoints: this._breakpointList,
      diagnostics: this._diagnostics,
      reachability: this._reachabilitySummary(),
      lastStopReason: DEBUG_STOP_REASONS.error,
      errorCode: this._sessionErrorCode,
      error: this._sessionError,
      terminal: true,
      canStepBack: false,
      canStepInto: false,
      canStepNext: false,
      canStepOut: false,
      canStepOutScope: false,
      canContinue: false,
      canRestart: false,
      createdAt: this._createdAt,
    })
  }

  // État minimal après libération des références.
  _disposedState() {
    return Object.freeze({
      sessionId: this.id,
      disposed: true,
      status: 'disposed',
      cursor: null,
      frameCount: 0,
      nodeId: null,
      currentNode: null,
      currentModule: null,
      currentClass: null,
      currentFunction: null,
      callStack: EMPTY_ARRAY,
      scopes: EMPTY_ARRAY,
      globals: EMPTY_ARRAY,
      locals: EMPTY_ARRAY,
      parameters: EMPTY_ARRAY,
      output: EMPTY_ARRAY,
      widgets: EMPTY_WIDGETS,
      screens: null,
      hasScreens: false,
      instructionCount: 0,
      navigationHistory: EMPTY_ARRAY,
      breakpoints: EMPTY_ARRAY,
      diagnostics: EMPTY_ARRAY,
      reachability: EMPTY_REACHABILITY_SUMMARY,
      lastStopReason: 'disposed',
      errorCode: null,
      error: null,
      terminal: true,
      canStepBack: false,
      canStepInto: false,
      canStepNext: false,
      canStepOut: false,
      canStepOutScope: false,
      canContinue: false,
      canRestart: false,
      createdAt: this._createdAt,
    })
  }

  /** Avance d'une frame, y compris dans un appel. */
  stepInto() {
    this._assertActive()
    if (this.terminal) return this.state()
    const previous = this.cursor
    if (!this._moveEngine('next')) return this.state()
    const frame = this._currentFrame()
    const breakpointNodeId = frame?.nodeId && this._breakpoints.has(frame.nodeId) ? frame.nodeId : null
    return this._finishMove({ action: 'step-into', baseReason: DEBUG_STOP_REASONS.stepInto, previousCursor: previous, breakpointNodeId })
  }

  /** Avance d'une instruction en sautant les appels, sauf point d'arrêt. */
  stepNext() {
    this._assertActive()
    if (this.terminal) return this.state()
    const previous = this.cursor
    const depth = this._callDepth(this._currentFrame())
    let target = previous + 1
    if (depth > 0 && this._callDepth(this._frames[target]) > depth) {
      while (target < this._frames.length - 1 && this._callDepth(this._frames[target]) > depth) target += 1
    }
    const breakpointIndex = this._firstBreakpoint(previous + 1, target)
    if (breakpointIndex !== null) target = breakpointIndex
    if (target === previous) return this.state()
    this._setCursor(target)
    const breakpointNodeId = breakpointIndex !== null ? this._frames[breakpointIndex].nodeId : null
    return this._finishMove({ action: 'step-next', baseReason: DEBUG_STOP_REASONS.stepNext, previousCursor: previous, breakpointNodeId })
  }

  /** Quitte la fonction ou la lambda courante, sauf point d'arrêt. */
  stepOut() {
    this._assertActive()
    if (this.terminal) return this.state()
    const depth = this._callDepth(this._currentFrame())
    if (depth === 0) return this.state()
    const previous = this.cursor
    let target = previous + 1
    while (target < this._frames.length - 1 && this._callDepth(this._frames[target]) >= depth) target += 1
    const breakpointIndex = this._firstBreakpoint(previous + 1, target)
    if (breakpointIndex !== null) target = breakpointIndex
    if (target === previous) return this.state()
    this._setCursor(target)
    const breakpointNodeId = breakpointIndex !== null ? this._frames[breakpointIndex].nodeId : null
    return this._finishMove({ action: 'step-out', baseReason: DEBUG_STOP_REASONS.stepOut, previousCursor: previous, breakpointNodeId })
  }

  /** Quitte le scope lexical courant, comme la commande « Finish scope » de l'IDE. */
  stepOutScope() {
    this._assertActive()
    if (this.terminal) return this.state()
    const previous = this.cursor
    if (!this._moveEngine('scope')) return this.state()
    const frame = this._currentFrame()
    const breakpointNodeId = frame?.nodeId && this._breakpoints.has(frame.nodeId) ? frame.nodeId : null
    return this._finishMove({ action: 'step-out-scope', baseReason: DEBUG_STOP_REASONS.stepOutScope, previousCursor: previous, breakpointNodeId })
  }

  /** Reprend jusqu'au prochain point d'arrêt ou à la fin de la trace. */
  continue() {
    this._assertActive()
    if (this.terminal) return this.state()
    const previous = this.cursor
    if (!this._moveEngine('continue')) return this.state()
    const frame = this._currentFrame()
    const breakpointNodeId = frame?.nodeId && this._breakpoints.has(frame.nodeId) ? frame.nodeId : null
    return this._finishMove({ action: 'continue', baseReason: DEBUG_STOP_REASONS.continue, previousCursor: previous, breakpointNodeId })
  }

  /** Restaure la position précédente de l'historique de navigation. */
  stepBack() {
    this._assertActive()
    if (!this.canStepBack) return this.state()
    const previous = this.cursor
    if (!this._moveEngine('back')) return this.state()
    return this._finishMove({ action: 'step-back', baseReason: DEBUG_STOP_REASONS.stepBack, previousCursor: previous, resume: false })
  }

  /** Revient à la première frame et oublie l'historique de navigation. */
  restart() {
    this._assertActive()
    if (!this.canRestart) return this.state()
    const previous = this.cursor
    if (!this._moveEngine('restart')) return this.state()
    this._emit('restart', { from: previous, to: this.cursor })
    return this._finishMove({ action: 'restart', baseReason: DEBUG_STOP_REASONS.restart, previousCursor: previous, resume: false })
  }

  /** Remplace tous les points d'arrêt. */
  setBreakpoints(value) {
    this._assertActive()
    const list = normalizeBreakpoints(this._project, value)
    const next = new Set(list)
    if (sameSet(this._breakpoints, next)) return this._breakpointList
    this._applyBreakpoints(next)
    return this._breakpointList
  }

  /** Ajoute un point d'arrêt sur un nœud source existant. */
  addBreakpoint(nodeId) {
    this._assertActive()
    assertBreakpointNode(this._project, nodeId)
    if (this._breakpoints.has(nodeId)) return this._breakpointList
    const next = new Set(this._breakpoints)
    next.add(nodeId)
    this._applyBreakpoints(next)
    return this._breakpointList
  }

  /** Retire un point d'arrêt ; un identifiant absent est sans effet. */
  removeBreakpoint(nodeId) {
    this._assertActive()
    assertId(nodeId, 'node id')
    if (!this._breakpoints.has(nodeId)) return this._breakpointList
    const next = new Set(this._breakpoints)
    next.delete(nodeId)
    this._applyBreakpoints(next)
    return this._breakpointList
  }

  /** Retire tous les points d'arrêt. */
  clearBreakpoints() {
    this._assertActive()
    if (this._breakpoints.size === 0) return this._breakpointList
    this._applyBreakpoints(new Set())
    return this._breakpointList
  }

  // Applique un nouvel ensemble de points d'arrêt et publie l'événement.
  _applyBreakpoints(next) {
    this._breakpoints = next
    this._breakpointList = Object.freeze([...next].sort())
    this._engineSession = { ...this._engineSession, breakpoints: next }
    this._emit('breakpoints', { breakpoints: this._breakpointList })
  }

  /** Retourne la liste triée des points d'arrêt. */
  getBreakpoints() {
    this._assertActive()
    return this._breakpointList
  }

  /** Retourne une frame brute gelée, ou null si la session est vide. */
  getFrame(index = this.cursor) {
    this._assertActive()
    if (this._frames.length === 0) return null
    const resolved = index === undefined || index === null ? this.cursor : index
    assertFrameIndex(resolved, this._frames.length)
    return this._frames[resolved]
  }

  /** Reconstruit les écrans complets d'une frame, à la demande. */
  getScreens(index = this.cursor) {
    this._assertActive()
    if (this._frames.length === 0) return EMPTY_OBJECT
    const resolved = index === undefined || index === null ? this.cursor : index
    assertFrameIndex(resolved, this._frames.length)
    return deepFreeze(resolveDebugScreens(this._frames, resolved))
  }

  /** Retourne les widgets non-écran, et les écrans seulement si demandés. */
  getWidgets(options = {}) {
    this._assertActive()
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected a widgets options object.')
    }
    const includeScreens = options.screens === true
    const index = options.index === undefined ? this.cursor : options.index
    if (this._frames.length === 0) return Object.freeze({ ...EMPTY_WIDGETS, screens: null })
    assertFrameIndex(index, this._frames.length)
    const widgets = widgetsOf(this._frames[index])
    if (!includeScreens) return Object.freeze({ ...widgets, screens: null })
    return Object.freeze({ ...widgets, screens: this.getScreens(index) })
  }

  /**
   * Retourne les instructions exécutées jusqu'au curseur, par fenêtre bornée.
   * `from` et `limit` portent sur les instructions, pas sur les frames brutes.
   */
  getInstructionHistory(options = {}) {
    this._assertActive()
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected an instruction history options object.')
    }
    const from = options.from === undefined ? 0 : options.from
    if (!Number.isSafeInteger(from) || from < 0) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected from to be a non-negative integer.', { details: { from } })
    }
    let limit = options.limit === undefined ? 100 : options.limit
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected limit to be a positive integer.', { details: { limit } })
    }
    limit = Math.min(limit, MAX_INSTRUCTION_LIMIT)
    const cursor = this.cursor
    const total = this._frames.length ? this._instructionCountAtFrame[cursor] ?? 0 : 0
    const selected = this._instructionFrameIndices.slice(from, from + limit).filter((index) => index <= cursor)
    const entries = selected.map((frameIndex, offset) => {
      const frame = this._frames[frameIndex]
      const node = frame.nodeId ? this._nodeById.get(frame.nodeId) ?? null : null
      const module = node ? this._moduleById.get(node.moduleId) ?? null : null
      const callStack = this._callStack(frame)
      const current = callStack.at(-1) ?? null
      return Object.freeze({
        ordinal: from + offset,
        frameIndex,
        nodeId: frame.nodeId,
        status: frame.status,
        errorCode: frame.errorCode ?? null,
        moduleId: node?.moduleId ?? null,
        moduleName: module?.name ?? null,
        functionNodeId: current?.nodeId ?? null,
        functionName: current?.name ?? null,
      })
    })
    return Object.freeze({ total, from, limit, entries: Object.freeze(entries) })
  }

  /** Retourne la source gelée, copiée à la création de la session. */
  getProject() {
    this._assertActive()
    return this._project
  }

  /** Retourne l'analyse d'accessibilité complète, gelée. */
  getReachability() {
    this._assertActive()
    return this._reachability
  }

  /** Retourne les diagnostics d'analyse associés à la session, gelés. */
  getDiagnostics() {
    this._assertActive()
    return this._diagnostics
  }

  /**
   * Produit un export structuré et borné de la trace.
   *
   * Options : `from`, `to`, `maxFrames`, `maxOutputEntries`, `includeVariables`,
   * `includeOutput`, `includeWidgets`, `includeScreens`, `includeReachability`,
   * `includeDiagnostics`, `includeProject`.
   */
  exportTrace(options = {}) {
    this._assertActive()
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected a trace export options object.')
    }
    const maxFrames = integerOption(options.maxFrames, 1000, 1, MAX_EXPORT_FRAMES, 'maxFrames')
    const maxOutputEntries = integerOption(options.maxOutputEntries, 1000, 1, MAX_EXPORT_OUTPUT, 'maxOutputEntries')
    const from = Math.min(integerOption(options.from, 0, 0, Number.MAX_SAFE_INTEGER, 'from'), this._frames.length)
    const to = Math.min(integerOption(options.to, this._frames.length, 0, Number.MAX_SAFE_INTEGER, 'to'), this._frames.length)
    if (to < from) {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected to to be greater than or equal to from.', { details: { from, to } })
    }
    const end = Math.min(to, from + maxFrames)
    const includeVariables = options.includeVariables !== false
    const includeOutput = options.includeOutput !== false
    const includeWidgets = options.includeWidgets === true
    const includeScreens = options.includeScreens === true
    const includeReachability = options.includeReachability !== false
    const includeDiagnostics = options.includeDiagnostics !== false
    const includeProject = options.includeProject === true
    const frames = []
    for (let index = from; index < end; index += 1) {
      const frame = this._frames[index]
      const node = frame.nodeId ? this._nodeById.get(frame.nodeId) ?? null : null
      const module = node ? this._moduleById.get(node.moduleId) ?? null : null
      const entry = {
        index,
        nodeId: frame.nodeId ?? null,
        status: frame.status,
        errorCode: frame.errorCode ?? null,
        moduleId: node?.moduleId ?? null,
        moduleName: module?.name ?? null,
        callStack: this._callStack(frame),
        scopeIds: frame.scopeIds ?? EMPTY_ARRAY,
      }
      if (includeVariables) {
        entry.globals = frame.globals ?? EMPTY_ARRAY
        entry.localScopes = frame.localScopes ?? EMPTY_ARRAY
      }
      if (includeOutput) {
        const output = frame.output ?? EMPTY_ARRAY
        if (output.length > maxOutputEntries) {
          entry.output = Object.freeze(output.slice(0, maxOutputEntries))
          entry.outputTruncated = true
        } else {
          entry.output = output
        }
      }
      if (includeWidgets) entry.widgets = widgetsOf(frame)
      if (includeScreens) entry.screens = deepFreeze(resolveDebugScreens(this._frames, index))
      frames.push(Object.freeze(entry))
    }
    const current = this._currentFrame()
    const summary = Object.freeze({
      frameCount: this._frames.length,
      from,
      to,
      exportedFrames: frames.length,
      cursor: this.cursor,
      status: this.status,
      lastStopReason: this._lastStopReason,
      errorCode: this.errorCode,
      traceErrorCode: this._traceErrorCode,
      breakpoints: this._breakpointList,
      outputLength: current?.output?.length ?? 0,
      truncated: from > 0 || end < to,
      maxFrames,
      maxOutputEntries,
      includes: Object.freeze({
        variables: includeVariables,
        output: includeOutput,
        widgets: includeWidgets,
        screens: includeScreens,
        reachability: includeReachability,
        diagnostics: includeDiagnostics,
        project: includeProject,
      }),
    })
    return Object.freeze({
      format: 'sapphire3-debug-trace',
      version: 1,
      sessionId: this.id,
      createdAt: this._createdAt,
      exportedAt: new Date().toISOString(),
      source: Object.freeze({ projectId: this._project.id ?? null, formatVersion: this._project.formatVersion ?? null }),
      summary,
      frames: Object.freeze(frames),
      project: includeProject ? this._project : null,
      reachability: includeReachability ? this._reachability : null,
      diagnostics: includeDiagnostics ? this._diagnostics : null,
    })
  }

  /**
   * Abonne un écouteur à un type d'événement, ou à `*`.
   * Retourne une fonction de désabonnement.
   */
  on(type, listener) {
    this._assertActive()
    assertEventType(type)
    if (typeof listener !== 'function') {
      throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, 'Expected an event listener function.')
    }
    let listeners = this._listeners.get(type)
    if (!listeners) {
      listeners = new Set()
      this._listeners.set(type, listeners)
    }
    listeners.add(listener)
    return () => this.off(type, listener)
  }

  /** Retire un écouteur précis. */
  off(type, listener) {
    if (typeof type !== 'string' || (type !== '*' && !DEBUG_EVENT_TYPES.includes(type))) return false
    const listeners = this._listeners.get(type)
    if (!listeners || typeof listener !== 'function') return false
    const removed = listeners.delete(listener)
    if (listeners.size === 0) this._listeners.delete(type)
    return removed
  }

  /** Compte les abonnés d'un type, ou tous les abonnés si `type` est omis. */
  listenerCount(type) {
    if (type !== undefined) {
      if (typeof type !== 'string' || (type !== '*' && !DEBUG_EVENT_TYPES.includes(type))) return 0
      return this._listeners.get(type)?.size ?? 0
    }
    let total = 0
    for (const listeners of this._listeners.values()) total += listeners.size
    return total
  }

  /** Libère les références et désabonne tous les écouteurs. Idempotent. */
  dispose() {
    if (this._disposed) return
    this._disposed = true
    this._emit('disposed', {})
    this._listeners.clear()
    this._externalListener = null
    this._frames = EMPTY_ARRAY
    this._project = null
    this._reachability = null
    this._diagnostics = EMPTY_ARRAY
    this._nodeById = new Map()
    this._moduleById = new Map()
    this._scopeKindByInstance = new Map()
    this._nodeIdByInstance = new Map()
    this._instructionFrameIndices = EMPTY_ARRAY
    this._instructionCountAtFrame = EMPTY_ARRAY
    this._hasScreens = false
    this._traceErrorCode = null
    this._engineSession = null
    this._breakpoints.clear()
    this._breakpointList = EMPTY_ARRAY
    this._lastStopReason = 'disposed'
  }
}

// Crée une session de débogage indépendante à partir d'un projet valide.
export function createDebugSession(project, options = {}) {
  return new DebugSession(project, options)
}
