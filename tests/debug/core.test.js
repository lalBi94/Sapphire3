import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEBUG_API_VERSION,
  DEBUG_ERROR_CODES,
  DEBUG_EVENT_TYPES,
  DEBUG_STOP_REASONS,
  DEBUG_VERSION,
  DebugError,
  createDebugSession,
  isDebugError,
} from '../../packages/debug/src/index.js'
import {
  analyzeProgram,
  analyzeReachability,
  createDebugSession as createEngineDebugSession,
  moveDebugSession,
  simulateProgram,
} from '../../src/utils/logic/index.js'
import { debugFixture } from '../logic/fixtures.js'
import { examples } from '../../src/utils/examples.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'
import { addFunction, addModule, createProject, drafts, types } from '../../packages/core/src/index.js'

// Avance par Step Into jusqu'à un nœud attendu.
function advanceTo(session, nodeId, limit = 500) {
  let state = session.state()
  for (let index = 0; index < limit && state.nodeId !== nodeId && !state.terminal; index += 1) state = session.stepInto()
  assert.equal(state.nodeId, nodeId)
  return state
}

// Construit une boucle for déterministe avec deux itérations.
function loopProject() {
  let project = createProject('debug-loop')
  project = addModule(project, { id: 'app', name: 'App' }).project
  return addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.forStatement({
        initializer: drafts.variable('i', types.int, drafts.literal(types.int, 0)),
        test: drafts.binary('<', drafts.reference('i'), drafts.literal(types.int, 2)),
        update: drafts.assignment(drafts.reference('i'), drafts.binary('+', drafts.reference('i'), drafts.literal(types.int, 1))),
        body: [drafts.print(drafts.reference('i'))],
      }),
      drafts.print(drafts.literal(types.int, 9)),
    ],
  }).project
}

// Construit un appel de lambda avec un paramètre et un retour entier.
function lambdaProject() {
  let project = createProject('debug-lambda')
  project = addModule(project, { id: 'app', name: 'App' }).project
  project = addFunction(project, 'app', {
    name: 'apply',
    returnType: types.int,
    parameters: [
      { name: 'value', type: types.int },
      { name: 'transform', type: { kind: 'function', parameters: [types.int], returnType: types.int } },
    ],
    body: [drafts.returnStatement(drafts.call(drafts.reference('transform'), [drafts.reference('value')]))],
  }).project
  return addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('result', types.int, drafts.call(drafts.reference('apply'), [
        drafts.literal(types.int, 21),
        drafts.lambda({
          returnType: types.int,
          parameters: [{ name: 'x', type: types.int }],
          body: drafts.binary('*', drafts.reference('x'), drafts.literal(types.int, 2)),
        }),
      ])),
      drafts.print(drafts.reference('result')),
    ],
  }).project
}

test('debug : version, constantes et erreurs d’API', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/debug/package.json', import.meta.url), 'utf8'))
  assert.equal(DEBUG_VERSION, packageJson.version)
  assert.equal(DEBUG_API_VERSION, 1)
  assert.ok(DEBUG_EVENT_TYPES.includes('position'))
  assert.equal(DEBUG_STOP_REASONS.breakpoint, 'breakpoint')

  assert.throws(() => createDebugSession(null), (error) => isDebugError(error) && error.code === DEBUG_ERROR_CODES.invalidProject)
  assert.throws(
    () => createDebugSession(debugFixture(), { breakpoints: ['missing'] }),
    (error) => error instanceof DebugError && error.code === DEBUG_ERROR_CODES.unknownNode,
  )
  assert.throws(
    () => createDebugSession(debugFixture(), { maxSteps: 0 }),
    (error) => error.code === DEBUG_ERROR_CODES.invalidArgument,
  )

  const session = createDebugSession(debugFixture())
  assert.equal(session.sessionId, session.id)
  assert.equal(session.status, 'paused')
  assert.equal(session.frameCount, 12)
  assert.equal(session.lastStopReason, 'initial')
  assert.equal(session.getFrame().nodeId, 'g')
  assert.equal(session.getFrame(11).status, 'completed')
  assert.throws(() => session.getFrame(99), (error) => error.code === DEBUG_ERROR_CODES.invalidIndex)
})

test('debug : exécution d’une fonction choisie avec arguments', () => {
  const session = createDebugSession(debugFixture(), { functionId: 'twice', args: [3] })
  const state = session.stepInto()
  assert.equal(state.currentFunction.name, 'twice')
  assert.equal(state.parameters.find((entry) => entry.name === 'n').value, 3)
  const finished = session.continue()
  assert.equal(finished.status, 'completed')
  assert.equal(finished.globals.find((entry) => entry.name === 'g').value, 2)
})

test('debug : événements structurés, abonnement et désabonnement', () => {
  const events = []
  const session = createDebugSession(debugFixture(), { onEvent: (event) => events.push(event) })
  assert.deepEqual(events.map((event) => event.type), ['created'])

  const seen = []
  const positions = []
  const offAll = session.on('*', (event) => seen.push(event))
  const offPosition = session.on('position', (event) => positions.push(event))
  const state = session.stepInto()
  assert.equal(state.nodeId, 'main')
  assert.deepEqual(seen.map((event) => event.type), ['resume', 'position', 'stop'])
  assert.deepEqual(positions.map((event) => event.nodeId), ['main'])
  assert.equal(seen[0].sequence, 2)
  assert.equal(seen[0].sessionId, session.id)
  assert.equal(typeof seen[0].timestamp, 'number')

  offAll()
  offPosition()
  assert.equal(session.listenerCount(), 0)
  session.stepInto()
  assert.equal(seen.length, 3)
  assert.equal(events.filter((event) => event.type === 'position').length, 2)
  assert.equal(JSON.stringify(seen).includes('sessionId'), true)
})

test('debug : appels imbriqués, step over, step into et step out', () => {
  const session = createDebugSession(debugFixture())
  let state = session.stepInto()
  assert.equal(state.nodeId, 'main')
  state = session.stepInto()
  assert.equal(state.nodeId, 'local')
  state = session.stepNext()
  assert.equal(state.nodeId, 'condition')
  state = session.stepNext()
  assert.equal(state.nodeId, 'inner')
  state = session.stepNext()
  assert.equal(state.nodeId, 'callPrint')
  assert.equal(state.callStack.length, 1)

  state = session.stepNext()
  assert.equal(state.nodeId, 'printAfter')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.stepNext)
  assert.deepEqual(state.output, ['6'])
  assert.equal(state.callStack.length, 1)

  const into = createDebugSession(debugFixture())
  advanceTo(into, 'callPrint')
  state = into.stepInto()
  assert.equal(state.nodeId, 'twice')
  assert.deepEqual(state.callStack.map((entry) => entry.name), ['start', 'twice'])
  assert.equal(state.currentFunction.name, 'twice')
  assert.equal(state.parameters.find((entry) => entry.name === 'n').value, 3)
  assert.equal(state.currentModule.name, 'Debug')
  state = into.stepOut()
  assert.equal(state.nodeId, 'printAfter')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.stepOut)
  assert.deepEqual(state.output, ['6'])
  assert.equal(state.callStack.length, 1)

  const end = createDebugSession(debugFixture())
  end.stepInto()
  state = end.stepOut()
  assert.equal(state.nodeId, null)
  assert.equal(state.status, 'completed')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.end)

  const global = createDebugSession(debugFixture())
  assert.equal(global.stepOut().nodeId, 'g')
})

test('debug : retour arrière, historique et redémarrage', () => {
  const session = createDebugSession(debugFixture())
  session.stepInto()
  session.stepInto()
  session.stepNext()
  let state = session.state()
  assert.equal(state.nodeId, 'condition')
  assert.equal(state.navigationHistory.length, 3)

  state = session.stepBack()
  assert.equal(state.nodeId, 'local')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.stepBack)
  state = session.stepBack()
  assert.equal(state.nodeId, 'main')
  state = session.stepBack()
  assert.equal(state.nodeId, 'g')
  assert.equal(state.canStepBack, false)
  const before = session.state()
  assert.equal(session.stepBack().cursor, before.cursor)

  const printSession = createDebugSession(debugFixture())
  advanceTo(printSession, 'callPrint')
  const atPrint = printSession.stepNext()
  assert.deepEqual(atPrint.output, ['6'])
  const back = printSession.stepBack()
  assert.equal(back.nodeId, 'callPrint')
  assert.deepEqual(back.output, [])

  const restarted = printSession.restart()
  assert.equal(restarted.nodeId, 'g')
  assert.equal(restarted.lastStopReason, DEBUG_STOP_REASONS.restart)
  assert.deepEqual(restarted.navigationHistory, [])
})

test('debug : points d’arrêt par nœud, sauts et événements', () => {
  const events = []
  const session = createDebugSession(debugFixture(), { breakpoints: ['increment'], onEvent: (event) => events.push(event) })
  assert.deepEqual(session.getBreakpoints(), ['increment'])
  let state = session.continue()
  assert.equal(state.nodeId, 'increment')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.breakpoint)
  assert.ok(events.some((event) => event.type === 'breakpoint' && event.nodeId === 'increment'))
  state = session.continue()
  assert.equal(state.nodeId, null)
  assert.equal(state.status, 'completed')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.end)

  const skip = createDebugSession(debugFixture(), { breakpoints: ['increment'] })
  advanceTo(skip, 'callPrint')
  state = skip.stepNext()
  assert.equal(state.nodeId, 'increment')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.breakpoint)

  const out = createDebugSession(debugFixture(), { breakpoints: ['increment'] })
  advanceTo(out, 'twice')
  state = out.stepOut()
  assert.equal(state.nodeId, 'increment')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.breakpoint)

  const api = createDebugSession(debugFixture())
  const breakpointEvents = []
  api.on('breakpoints', (event) => breakpointEvents.push(event.breakpoints))
  assert.deepEqual(api.addBreakpoint('printAfter'), ['printAfter'])
  assert.deepEqual(api.addBreakpoint('printAfter'), ['printAfter'])
  assert.deepEqual(api.setBreakpoints(['condition', 'inner']), ['condition', 'inner'])
  assert.deepEqual(api.removeBreakpoint('condition'), ['inner'])
  assert.deepEqual(api.clearBreakpoints(), [])
  assert.deepEqual(breakpointEvents, [['printAfter'], ['condition', 'inner'], ['inner'], []])
  assert.throws(() => api.addBreakpoint('missing'), (error) => error.code === DEBUG_ERROR_CODES.unknownNode)

  const unreachable = createDebugSession(debugFixture(), { breakpoints: ['deadPrint'] })
  state = unreachable.continue()
  assert.equal(state.nodeId, null)
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.end)
})

test('debug : inspection, portées, historique, accessibilité et lecture seule', () => {
  const session = createDebugSession(debugFixture())
  const state = advanceTo(session, 'callPrint')
  assert.equal(state.currentNode.id, 'callPrint')
  assert.equal(state.currentNode.kind, 'PrintStatement')
  assert.equal(state.currentModule.name, 'Debug')
  assert.equal(state.currentFunction.name, 'start')
  assert.equal(state.currentClass, null)
  assert.deepEqual(state.callStack.map((entry) => entry.name), ['start'])
  assert.equal(state.scopes.length, 2)
  assert.equal(state.scopes[0].kind, 'block')
  assert.equal(state.scopes[1].kind, 'function')
  assert.equal(state.globals.find((entry) => entry.name === 'g').value, 1)
  assert.deepEqual(state.locals.filter((entry) => entry.name === 'x').map((entry) => entry.value), [3, 2])
  assert.deepEqual(state.parameters, [])
  assert.deepEqual(state.output, [])
  assert.deepEqual(Object.keys(state.widgets), ['gauges', 'leds', 'rgbLeds', 'progresses', 'barCharts', 'xyPlots', 'oscilloscopes', 'heatmaps'])

  const history = session.getInstructionHistory()
  assert.equal(history.total, 6)
  assert.equal(history.entries.length, 6)
  assert.equal(history.entries[0].nodeId, 'g')
  assert.equal(history.entries.at(-1).nodeId, 'callPrint')
  assert.deepEqual(session.getInstructionHistory({ from: 5, limit: 1 }).entries.map((entry) => entry.nodeId), ['callPrint'])
  assert.deepEqual(session.getInstructionHistory({ from: 6 }).entries, [])

  assert.equal(session.getFrame().nodeId, 'callPrint')
  assert.equal(session.getFrame(0).nodeId, 'g')
  assert.equal(Object.isFrozen(session.getProject()), true)
  assert.equal(session.getProject().id, 'debug')
  assert.ok(session.getReachability().functions.some((entry) => entry.nodeId === 'twice' && entry.reachable))
  assert.deepEqual(session.getDiagnostics(), [])
  assert.deepEqual(session.getScreens(), {})
  assert.deepEqual(session.getWidgets({ screens: true }).screens, {})

  assert.equal(Object.isFrozen(state), true)
  assert.equal(Object.isFrozen(state.globals[0]), true)
  assert.equal(Object.isFrozen(state.locals[0]), true)
  assert.equal(Object.isFrozen(state.callStack[0]), true)
  assert.equal(Object.isFrozen(state.scopes[0]), true)
  assert.equal(Object.isFrozen(state.widgets), true)
  assert.throws(() => {
    state.globals[0].value = 99
  }, TypeError)
  assert.doesNotThrow(() => JSON.stringify(state))
})

test('debug : récursion et profondeur de pile', () => {
  const workspace = examples.find((example) => example.id === 'recursion').build()
  const session = createDebugSession(workspace.project)
  let state = session.state()
  for (let index = 0; index < 500 && state.callStack.length < 3 && !state.terminal; index += 1) state = session.stepInto()
  assert.ok(state.callStack.length >= 3)
  assert.equal(state.currentFunction.name, 'factorial')
  assert.ok(state.callStack.every((entry, index) => index === 0 ? entry.name === 'main' : entry.name === 'factorial'))
  assert.ok(state.parameters.some((entry) => entry.name === 'n' && typeof entry.value === 'number'))
  state = session.continue()
  assert.equal(state.status, 'completed')
  assert.deepEqual(state.output, ['120'])
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.end)
})

test('debug : classes, méthodes et constructeur', () => {
  const workspace = workspaceTemplates.find((template) => template.id === 'classInstance').build()
  const session = createDebugSession(workspace.project)
  const methods = new Set()
  let state = session.state()
  while (!state.terminal) {
    state = session.stepInto()
    if (state.currentFunction?.className === 'Counter') methods.add(state.currentFunction.name)
    if (state.currentClass) {
      assert.equal(state.currentModule.kind, 'class')
      assert.equal(state.currentClass.name, 'Counter')
    }
  }
  assert.deepEqual([...methods].sort(), ['add', 'constructor', 'get'])
  assert.equal(state.status, 'completed')
  assert.deepEqual(state.output, ['3'])
})

test('debug : boucles, valeurs successives et historique d’instructions', () => {
  const project = loopProject()
  const session = createDebugSession(project)
  const values = []
  const loopScopes = []
  let state = session.state()
  while (!state.terminal) {
    state = session.stepInto()
    const index = state.locals.find((entry) => entry.name === 'i')
    if (index?.initialized) values.push(index.value)
    if (state.scopes.some((scope) => scope.kind === 'for')) loopScopes.push(state.nodeId)
  }
  assert.ok(values.includes(0))
  assert.ok(values.includes(1))
  assert.ok(loopScopes.length > 0)
  assert.deepEqual(state.output, ['0', '1', '9'])

  const printNodes = project.nodes.filter((node) => node.kind === 'PrintStatement')
  const loopPrint = printNodes.find((node) => project.nodes.find((entry) => entry.id === node.children.value)?.kind === 'Reference')
  const history = session.getInstructionHistory({ limit: 1000 })
  assert.ok(history.entries.filter((entry) => entry.nodeId === loopPrint.id).length >= 2)
  const window = session.getInstructionHistory({ from: 1, limit: 2 })
  assert.equal(window.entries.length, 2)
  assert.deepEqual(window.entries.map((entry) => entry.ordinal), [1, 2])
})

test('debug : tableaux, pointeurs et lambdas inspectables', () => {
  for (const id of ['arrays', 'pointers']) {
    const workspace = examples.find((example) => example.id === id).build()
    const session = createDebugSession(workspace.project)
    let state = session.state()
    let sawArray = false
    let sawPointer = false
    while (!state.terminal) {
      state = session.stepInto()
      for (const entry of [...state.globals, ...state.locals]) {
        if (entry.array) {
          sawArray = true
          assert.ok(entry.array.length > 0)
          assert.ok(entry.array.cells.length > 0)
        }
        if (entry.pointer) {
          sawPointer = true
          assert.equal(typeof entry.pointer.label, 'string')
        }
      }
    }
    assert.deepEqual(state.output, simulateProgram(workspace.project).output)
    if (id === 'arrays') assert.equal(sawArray, true)
    if (id === 'pointers') assert.equal(sawPointer, true)
  }

  const lambdaSession = createDebugSession(lambdaProject())
  let state = lambdaSession.state()
  for (let index = 0; index < 100 && !state.terminal && !state.callStack.some((entry) => entry.isLambda); index += 1) state = lambdaSession.stepInto()
  assert.ok(state.callStack.some((entry) => entry.isLambda))
  assert.equal(state.currentFunction.kind, 'LambdaExpression')
  assert.equal(state.currentFunction.name, '<lambda>')
  assert.equal(state.parameters.find((entry) => entry.name === 'x').value, 21)
  state = lambdaSession.continue()
  assert.equal(state.status, 'completed')
  assert.deepEqual(state.output, ['42'])
})

test('debug : fin de trace, erreur runtime et redémarrage', () => {
  const session = createDebugSession(debugFixture())
  const finished = []
  session.on('finished', (event) => finished.push(event))
  let state = session.continue()
  assert.equal(state.nodeId, null)
  assert.equal(state.status, 'completed')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.end)
  assert.equal(finished.length, 1)
  assert.equal(finished[0].ok, true)

  const terminalCursor = state.cursor
  assert.equal(session.stepInto().cursor, terminalCursor)
  assert.equal(session.stepNext().cursor, terminalCursor)
  assert.equal(session.stepOut().cursor, terminalCursor)
  assert.equal(session.continue().cursor, terminalCursor)
  assert.equal(session.stepOutScope().cursor, terminalCursor)

  state = session.stepBack()
  assert.equal(state.nodeId, 'g')
  assert.equal(session.canRestart, false)
  assert.equal(session.restart().nodeId, 'g')

  const walk = createDebugSession(debugFixture())
  const walkRestarted = []
  walk.on('restart', (event) => walkRestarted.push(event))
  while (!walk.state().terminal) walk.stepInto()
  state = walk.stepBack()
  assert.equal(state.nodeId, 'returnMain')
  state = walk.restart()
  assert.equal(state.nodeId, 'g')
  assert.equal(walkRestarted.length, 1)
  assert.equal(walkRestarted[0].from, 10)
  assert.equal(walkRestarted[0].to, 0)

  const broken = debugFixture()
  broken.nodes.find((node) => node.id === 'local').children.initializer = null
  broken.nodes = broken.nodes.filter((node) => node.id !== 'two')
  const errorSession = createDebugSession(broken)
  const errors = []
  const errorFinished = []
  errorSession.on('error', (event) => errors.push(event))
  errorSession.on('finished', (event) => errorFinished.push(event))
  state = errorSession.continue()
  assert.equal(state.status, 'error')
  assert.equal(state.lastStopReason, DEBUG_STOP_REASONS.error)
  assert.equal(state.errorCode, 'SIMULATION_UNINITIALIZED')
  assert.equal(errors.length, 1)
  assert.equal(errorFinished.length, 1)
  assert.equal(errorFinished[0].ok, false)
})

test('debug : export de trace borné, widgets et écrans', () => {
  const session = createDebugSession(debugFixture())
  session.stepInto()
  const trace = session.exportTrace()
  assert.equal(trace.format, 'sapphire3-debug-trace')
  assert.equal(trace.version, 1)
  assert.equal(trace.summary.frameCount, 12)
  assert.equal(trace.summary.exportedFrames, 12)
  assert.equal(trace.summary.truncated, false)
  assert.equal(trace.frames[0].nodeId, 'g')
  assert.equal(trace.frames[0].globals.length, 1)
  assert.ok(Array.isArray(trace.frames[0].output))
  assert.equal('widgets' in trace.frames[0], false)
  assert.equal('screens' in trace.frames[0], false)
  assert.equal(trace.project, null)
  assert.equal(trace.reachability.ok, true)
  assert.deepEqual(trace.diagnostics, [])
  assert.doesNotThrow(() => JSON.stringify(trace))

  const limited = session.exportTrace({ maxFrames: 2 })
  assert.equal(limited.frames.length, 2)
  assert.equal(limited.summary.truncated, true)
  const range = session.exportTrace({ from: 10, to: 12 })
  assert.deepEqual(range.frames.map((frame) => frame.nodeId), ['returnMain', null])
  assert.equal(range.summary.truncated, true)

  const stripped = session.exportTrace({ includeVariables: false, includeOutput: false, includeWidgets: true, includeScreens: true, includeProject: true })
  assert.equal('globals' in stripped.frames[0], false)
  assert.equal('output' in stripped.frames[0], false)
  assert.ok('widgets' in stripped.frames[0])
  assert.ok('screens' in stripped.frames[0])
  assert.equal(stripped.project.id, 'debug')
  assert.equal(Object.isFrozen(stripped.project), true)

  assert.throws(() => session.exportTrace({ maxFrames: 0 }), (error) => error.code === DEBUG_ERROR_CODES.invalidArgument)
  assert.throws(() => session.exportTrace({ from: 5, to: 2 }), (error) => error.code === DEBUG_ERROR_CODES.invalidArgument)

  const widgetWorkspace = workspaceTemplates.find((template) => template.id === 'widgetDashboard').build()
  const widgetSession = createDebugSession(widgetWorkspace.project)
  assert.equal(widgetSession.state().hasScreens, true)
  const screenState = widgetSession.getScreens()
  assert.ok(screenState.templateScreen.width > 0)
  const widgets = widgetSession.getWidgets({ screens: true })
  assert.ok(widgets.screens.templateScreen.width > 0)
  const final = widgetSession.continue()
  assert.deepEqual(final.output, ['Dashboard ready'])
  assert.equal(final.widgets.gauges.templateGauge.value, 47)
  assert.equal(Object.keys(final.widgets.leds).length, 1)
  assert.ok(widgetSession.getScreens().templateScreen.pixels.length > 0)
  const finalTrace = widgetSession.exportTrace({ from: final.frameCount - 1, to: final.frameCount, includeWidgets: true, includeScreens: true })
  assert.equal(finalTrace.frames.length, 1)
  assert.equal(finalTrace.frames[0].widgets.gauges.templateGauge.value, 47)
  assert.ok(finalTrace.frames[0].screens.templateScreen.pixels.length > 0)
})

test('debug : non-régression avec le débogueur du moteur', () => {
  const project = debugFixture()
  const engine = createEngineDebugSession(project)
  const sdk = createDebugSession(project)
  assert.equal(sdk.frameCount, engine.frames.length)
  for (let index = 0; index < engine.frames.length; index += 1) assert.equal(sdk.getFrame(index).nodeId, engine.frames[index].nodeId)
  assert.deepEqual(sdk.getFrame(sdk.frameCount - 1).output, simulateProgram(project).output)

  let engineSession = createEngineDebugSession(project)
  const sdkSession = createDebugSession(project)
  for (const [engineAction, sdkAction] of [['next', 'stepInto'], ['next', 'stepInto'], ['scope', 'stepOutScope'], ['back', 'stepBack'], ['continue', 'continue'], ['restart', 'restart']]) {
    engineSession = moveDebugSession(engineSession, engineAction)
    const state = sdkSession[sdkAction]()
    assert.equal(state.cursor, engineSession.cursor, `${engineAction}/${sdkAction}`)
  }
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  assert.deepEqual(analyzeReachability(project), engine.reachability)
})

test('debug : disposition, sessions multiples et absence de fuite', () => {
  const first = createDebugSession(debugFixture())
  const second = createDebugSession(debugFixture())
  first.stepInto()
  first.stepInto()
  assert.equal(first.state().nodeId, 'local')
  assert.equal(second.state().nodeId, 'g')

  const disposed = []
  first.on('disposed', (event) => disposed.push(event))
  first.dispose()
  assert.equal(first.disposed, true)
  assert.equal(first.status, 'disposed')
  assert.equal(first.state().status, 'disposed')
  assert.equal(first.listenerCount(), 0)
  assert.equal(disposed.length, 1)
  assert.throws(() => first.stepInto(), (error) => error.code === DEBUG_ERROR_CODES.disposed)
  assert.throws(() => first.on('stop', () => {}), (error) => error.code === DEBUG_ERROR_CODES.disposed)
  first.dispose()

  second.stepInto()
  assert.equal(second.state().nodeId, 'main')
})
