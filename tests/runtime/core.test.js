import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  RUNTIME_API_VERSION,
  RUNTIME_ERROR_CODES,
  RUNTIME_VERSION,
  RuntimeError,
  createRuntime,
  loadProject,
} from '../../packages/runtime/src/index.js'
import {
  addClass,
  addConstructor,
  addFunction,
  addMethod,
  addModule,
  addVariable,
  createProject,
  drafts,
  types,
} from '../../packages/core/src/index.js'
import { examples } from '../../src/utils/examples.js'
import { serializeWorkspace } from '../../src/utils/workspaceFile.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'

// Construit un projet minimal qui imprime une valeur.
function printProject(value = 42) {
  const empty = createProject('runtime-test')
  const withModule = addModule(empty, { id: 'app', name: 'App' })
  return addFunction(withModule.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.print(drafts.literal(types.int, value))],
  }).project
}

// Construit un projet avec une fonction add(int, int) -> int.
function addProject() {
  const empty = createProject('runtime-add')
  const withModule = addModule(empty, { id: 'app', name: 'App' })
  return addFunction(withModule.project, 'app', {
    name: 'add',
    returnType: types.int,
    parameters: [{ name: 'a', type: types.int }, { name: 'b', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('+', drafts.reference('a'), drafts.reference('b')))],
  }).project
}

// Construit un projet de classe Counter et une entrée qui l'utilise.
function classProject() {
  let project = createProject('runtime-class')
  project = addClass(project, { id: 'counter', name: 'Counter' }).project
  project = addVariable(project, 'counter', {
    name: 'value',
    type: types.int,
    initializer: drafts.literal(types.int, 0),
  }, { visibility: 'public' }).project
  project = addConstructor(project, 'counter', {
    parameters: [{ name: 'start', type: types.int }],
    body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
  }).project
  project = addMethod(project, 'counter', {
    name: 'increment',
    returnType: types.void,
    body: [drafts.assignment(
      drafts.member(drafts.thisExpression(), 'value'),
      drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
    )],
  }).project
  project = addModule(project, { id: 'app', name: 'App' }).project
  return addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
      drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
      drafts.print(drafts.member(drafts.reference('counter'), 'value')),
    ],
  }).project
}

// Construit une boucle infinie bornée par le budget du runtime.
function loopProject() {
  const empty = createProject('runtime-loop')
  const withModule = addModule(empty, { id: 'app', name: 'App' })
  return addFunction(withModule.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.whileStatement(drafts.literal(types.boolean, true), [])],
  }).project
}

// Récupère le workspace du tableau de bord animé.
function dashboardWorkspace() {
  return workspaceTemplates.find((template) => template.id === 'widgetDashboard').build()
}

// Récupère le workspace du modèle entrée → sortie.
function inputWorkspace() {
  return workspaceTemplates.find((template) => template.id === 'inputOutput').build()
}

test('Runtime : version du package et contrat public', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/runtime/package.json', import.meta.url), 'utf8'))
  assert.equal(RUNTIME_VERSION, packageJson.version)
  assert.equal(RUNTIME_API_VERSION, 1)
})

test('Runtime : charge un projet et exécute le point d’entrée', async () => {
  const project = printProject()
  const runtime = createRuntime(project)
  const statuses = []
  const outputs = []
  runtime.on('status', (event) => statuses.push(event.status))
  runtime.on('output', (event) => outputs.push(event.lines))
  const result = await runtime.run()
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'bounded')
  assert.deepEqual(result.output, ['42'])
  assert.deepEqual(outputs, [['42']])
  assert.ok(result.steps > 0)
  assert.equal(result.error, null)
  assert.ok(statuses.includes('running'))
  assert.ok(statuses.includes('done'))
  assert.equal(runtime.status, 'done')
  runtime.dispose()
})

test('Runtime : chargement JSON, workspace et workspace versionné', async () => {
  const project = printProject(7)
  const loadedJson = await loadProject(JSON.stringify(project))
  assert.equal(loadedJson.canGenerate, true)
  assert.equal(loadedJson.analysis.symbols.some((symbol) => symbol.name === 'main'), true)

  const workspace = dashboardWorkspace()
  const loadedWorkspace = await loadProject(workspace)
  assert.equal(loadedWorkspace.canGenerate, true)
  assert.equal(loadedWorkspace.project.modules.some((module) => module.id === 'templateScreen'), true)

  const text = serializeWorkspace(workspace.project, workspace.presentation.cards, workspace.presentation.camera, workspace.presentation.selected)
  const loadedText = await loadProject(text)
  assert.equal(loadedText.canGenerate, true)
  const runtime = createRuntime(text)
  const result = await runtime.run({ maxSteps: 20000 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['Dashboard ready'])
  runtime.dispose()
})

test('Runtime : fonction choisie, arguments typés et valeur de retour', async () => {
  const runtime = createRuntime(addProject())
  const byName = await runtime.runFunction('add', [2, 3])
  assert.equal(byName.ok, true)
  assert.equal(byName.result, 5)
  assert.equal(byName.returnValue, '5')
  const byObject = await runtime.runFunction({ name: 'add' }, [10, 20])
  assert.equal(byObject.result, 30)
  const invalid = await runtime.runFunction('add', ['x', 3])
  assert.equal(invalid.ok, false)
  assert.equal(invalid.error.code, 'SIMULATION_ARGUMENTS_INVALID')
  await assert.rejects(() => runtime.runFunction('missing'), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.functionNotFound)

  const first = addModule(createProject('ambiguous'), { id: 'a', name: 'A' }).project
  const second = addModule(first, { id: 'b', name: 'B' }).project
  const withA = addFunction(second, 'a', { name: 'dup', returnType: types.void, body: [] }).project
  const withB = addFunction(withA, 'b', { name: 'dup', returnType: types.void, body: [] }).project
  const ambiguous = createRuntime(withB)
  await assert.rejects(() => ambiguous.runFunction('dup'), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.functionAmbiguous)
  runtime.dispose()
  ambiguous.dispose()
})

test('Runtime : classes, constructeur et méthode', async () => {
  const runtime = createRuntime(classProject())
  const result = await runtime.run()
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['6'])
  runtime.dispose()
})

test('Runtime : budget, erreur de pas et annulation', async () => {
  const runtime = createRuntime(loopProject())
  const limited = await runtime.run({ maxSteps: 50 })
  assert.equal(limited.ok, false)
  assert.equal(limited.error.code, 'SIMULATION_STEP_LIMIT')
  await assert.rejects(() => runtime.run({ maxSteps: 0 }), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.invalidBudget)

  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => runtime.run({ signal: controller.signal }), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.cancelled)
  runtime.dispose()
})

test('Runtime : états des widgets en mode borné', async () => {
  const runtime = createRuntime(dashboardWorkspace(), { maxSteps: 20000 })
  const result = await runtime.run()
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['Dashboard ready'])
  assert.ok(result.widgets.screens.templateScreen)
  assert.equal(result.widgets.gauges.templateGauge.max, 100)
  assert.equal(typeof result.widgets.leds.templateLed.value, 'boolean')
  assert.equal(result.widgets.progresses.templateProgress.max, 100)
  assert.equal(result.widgets.barCharts.templateChart.values.length, 8)
  assert.equal(result.widgets.rgbLeds.templateRgb.blue, 128)
  assert.equal(result.frames.screens.length, 48)
  assert.ok(result.frames.gauges.length > 0)
  runtime.dispose()
})

test('Runtime : live, pause, reprise, arrêt et frames', async () => {
  const runtime = createRuntime(dashboardWorkspace(), { sliceSteps: 50 })
  const statuses = []
  let paused = false
  let resumed = false
  runtime.on('status', (event) => statuses.push(event.status))
  runtime.on('frame', (frame) => {
    if (!paused) {
      paused = true
      runtime.pause()
      setTimeout(() => {
        resumed = true
        runtime.resume()
      }, 10)
      return
    }
    if (resumed && frame.steps > 400) runtime.stop()
  })
  const result = await runtime.startLive({ captureFrames: true, maxFrames: 20 })
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'live')
  assert.equal(result.stopped, true)
  assert.ok(statuses.includes('paused'))
  assert.ok(statuses.includes('running'))
  assert.ok(statuses.includes('stopping'))
  assert.ok(statuses.includes('stopped'))
  assert.ok(result.frames.length > 0)
  assert.ok(result.widgets.gauges.templateGauge)
  runtime.dispose()
})

test('Runtime : événements d’entrée en live', async () => {
  const workspace = inputWorkspace()
  const inputModule = workspace.project.modules.find((module) => module.inputNumber)
  const callback = workspace.project.nodes.find((node) => node.moduleId === inputModule.id && node.kind === 'VariableDeclaration' && node.properties.name.includes('ONCHANGE'))
  const runtime = createRuntime(workspace, { sliceSteps: 20 })
  let sent = false
  runtime.on('frame', (frame) => {
    if (!sent) {
      sent = true
      runtime.sendEvents([{ nodeId: callback.id, value: 7 }])
    }
    if (frame.output.length > 0) runtime.stop()
  })
  const result = await runtime.startLive()
  assert.equal(result.ok, true)
  assert.ok(result.output.includes('7'))
  runtime.dispose()
})

test('Runtime : sessions indépendantes', async () => {
  const first = createRuntime(printProject(1))
  const second = createRuntime(printProject(2))
  const [one, two] = await Promise.all([first.run(), second.run()])
  assert.deepEqual(one.output, ['1'])
  assert.deepEqual(two.output, ['2'])
  assert.equal(first.status, 'done')
  assert.equal(second.status, 'done')
  first.dispose()
  second.dispose()
})

test('Runtime : erreurs typées, dispose et worker indisponible', async () => {
  const invalid = addModule(createProject('invalid'), { id: 'app', name: 'App' }).project
  invalid.modules[0].rootNodeIds.push('missing')
  assert.throws(() => createRuntime(invalid), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.invalidProject && error.diagnostics.some((diagnostic) => diagnostic.code === 'NODE_NOT_FOUND'))

  const runtime = createRuntime(printProject())
  assert.throws(() => runtime.pause(), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.notLive)
  runtime.dispose()
  await assert.rejects(() => runtime.run(), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.disposed)

  if (typeof Worker === 'undefined') {
    assert.throws(() => createRuntime(printProject(), { isolation: 'worker' }), (error) => error instanceof RuntimeError && error.code === RUNTIME_ERROR_CODES.workerUnavailable)
  }
})

test('Runtime : un exemple local s’exécute hors de l’IDE', async () => {
  const workspace = examples.find((example) => example.id === 'fibonacci').build()
  const runtime = createRuntime(workspace)
  const result = await runtime.run()
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['55'])
  runtime.dispose()
})
