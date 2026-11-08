import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, simulateProgram, bindInputButtonCallback, getUnusedDeclarationIds } from '../../src/utils/logic/index.js'
import { runLiveProgram } from '../../src/utils/logic/liveSimulation.js'
import { createInputButtonModule } from '../../src/utils/inputButtonNode.js'
import { inputButtonCallbackId, inputButtonOnClickBinding, inputButtonOnClickNodeId } from '../../src/utils/logic/inputButtonState.js'
import { createLedModule, ledDefaults } from '../../src/utils/ledNode.js'
import { examples } from '../../src/utils/examples.js'
import { dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { deserializeWorkspace, workspaceFileVersion } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const stringType = { kind: 'primitive', name: 'string' }

// Construit un bouton, une LED et une fonction onPress(bool) ; le binding est optionnel.
function inputProject({ mode = 'toggle', bind = true, live = false } = {}) {
  const project = createProject('inputTest')
  const button = createInputButtonModule('inputButton', 'Test button', 1, { mode })
  project.modules.push(button.module)
  project.nodes.push(...button.nodes)
  const led = createLedModule('inputLed', 'LED', 1, ledDefaults)
  project.modules.push(led.module)
  project.nodes.push(...led.nodes)
  const app = createModule('inputApp', 'Input app')
  project.modules.push(app)
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `inputTest:app:${++sequence}`
    nodes.push(createNode(id, app.id, kind, { properties, children, references }))
    return id
  }
  const setter = led.module.exports.find((entry) => entry.name === led.functions.setValue)
  app.imports.push({ id: 'inputApp:import:setLed', moduleId: led.module.id, nodeId: setter.nodeId, localName: 'setLed' })

  // function onPress(value: boolean): void { setLed(value); }
  const parameter = node('Parameter', { name: 'value', type: booleanType })
  const callee = node('Reference', {}, {}, { target: { kind: 'import', importId: 'inputApp:import:setLed' } })
  const argument = node('Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  const call = node('CallExpression', {}, { callee, arguments: [argument] })
  const statement = node('ExpressionStatement', {}, { expression: call })
  const callbackBody = node('Block', {}, { statements: [statement] })
  const callback = node('FunctionDeclaration', { name: 'onPress', type: voidType }, { parameters: [parameter], body: callbackBody })
  app.rootNodeIds.push(callback)

  if (live) {
    const flagValue = node('Literal', { type: booleanType, value: false })
    const flag = node('VariableDeclaration', { name: 'SP3_LIVE', type: booleanType }, { initializer: flagValue })
    app.rootNodeIds.push(flag)
  }
  const message = node('Literal', { type: stringType, value: 'ready' })
  const print = node('PrintStatement', {}, { value: message })
  const statements = [print]
  if (live) {
    const loopTest = node('Reference', {}, {}, { target: { kind: 'name', name: 'SP3_LIVE' } })
    const loopBody = node('Block', {}, { statements: [] })
    const loop = node('WhileStatement', {}, { test: loopTest, body: loopBody })
    statements.push(loop)
  }
  const mainBody = node('Block', {}, { statements })
  const main = node('FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: mainBody })
  app.rootNodeIds.push(main)
  project.nodes.push(...nodes)

  const bound = bind ? bindInputButtonCallback(project, button.module.id, callback) : { ok: true, project }
  return {
    project: bound.project,
    button,
    app,
    led,
    callbackId: callback,
    onClickNodeId: inputButtonOnClickNodeId(bound.project, button.module.id),
  }
}

// Produit les cartes de présentation minimales pour un projet de test.
function inputCards(button, app, pressed = false, led = null) {
  const type = button.module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton'
  return [
    { id: button.module.id, type, name: button.module.name, x: 0, y: 0, width: 280, height: 190, expandedNodeIds: [], pressed },
    { id: app.id, type: 'module', name: app.name, x: 600, y: 0, width: 520, height: 420, expandedNodeIds: [] },
    ...(led ? [{ id: led.module.id, type: 'led', name: led.module.name, x: 0, y: 420, width: 280, height: 190, expandedNodeIds: [] }] : []),
  ]
}

test('boutons d’entrée : onClick(bool) lié, sans isPress exporté', () => {
  for (const mode of ['toggle', 'hold']) {
    const { project, button, callbackId, onClickNodeId } = inputProject({ mode })
    assert.equal(button.module.inputButton.mode, mode)
    assert.equal(button.module.exports.some((entry) => entry.name === 'isPress'), false)
    assert.ok(onClickNodeId)
    assert.equal(inputButtonCallbackId(project, button.module.id), callbackId)
    assert.deepEqual(analyzeProgram(project).diagnostics, [])
    const unused = getUnusedDeclarationIds(project)
    assert.equal(unused.includes(onClickNodeId), false)
    assert.equal(unused.some((id) => project.nodes.find((node) => node.id === id)?.properties?.name?.startsWith('INPUT_SP3_GLOBAL_NOOP_')), false)
    assert.deepEqual(simulateProgram(project).output, ['ready'])
    assert.equal(transpileProgram(project).code.endsWith('_UNSUPPORTED'), true)
  }
})

test('binding : import créé puis retiré, fonction locale acceptée', () => {
  const { project, button, callbackId } = inputProject({ bind: false })
  assert.equal(inputButtonCallbackId(project, button.module.id), null)
  assert.equal(inputButtonOnClickBinding(project, button.module.id).target.kind, 'name')

  const bound = bindInputButtonCallback(project, button.module.id, callbackId)
  assert.equal(bound.ok, true)
  assert.equal(inputButtonCallbackId(bound.project, button.module.id), callbackId)
  const binding = inputButtonOnClickBinding(bound.project, button.module.id)
  assert.equal(binding.target.kind, 'import')
  const module = bound.project.modules.find((entry) => entry.id === button.module.id)
  assert.equal(module.imports.some((entry) => entry.id === binding.importId), true)
  assert.deepEqual(analyzeProgram(bound.project).diagnostics, [])

  const unbound = bindInputButtonCallback(bound.project, button.module.id, null)
  assert.equal(unbound.ok, true)
  assert.equal(inputButtonCallbackId(unbound.project, button.module.id), null)
  const unboundModule = unbound.project.modules.find((entry) => entry.id === button.module.id)
  assert.equal(unboundModule.imports.some((entry) => entry.id === binding.importId), false)
  assert.deepEqual(analyzeProgram(unbound.project).diagnostics, [])
})

test('run live : un événement onClick met à jour la LED avec le booléen', async () => {
  const { project, onClickNodeId } = inputProject({ live: true })
  const frames = []
  const result = await runLiveProgram(project, {
    sliceSteps: 20,
    onFrame: (state) => {
      frames.push(state)
      if (frames.length === 1) return { events: [{ nodeId: onClickNodeId, value: true }] }
      if (frames.length === 4) return { events: [{ nodeId: onClickNodeId, value: false }] }
      if (frames.length >= 7) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.stopped, true)
  assert.ok(frames.some((frame) => frame.leds.inputLed?.value === true))
  assert.equal(frames.at(-1).leds.inputLed.value, false)
})

test('boutons d’entrée : dashboard, callback et relecture du workspace', () => {
  const { project, button, app, led } = inputProject({ mode: 'hold' })
  const cards = inputCards(button, app, true, led)
  const widgets = dashboardWidgets(project, cards)
  assert.equal(widgets.length, 2)
  const buttonWidget = widgets.find((widget) => widget.id === button.module.id)
  assert.equal(buttonWidget.type, 'holdButton')
  assert.equal(buttonWidget.mode, 'hold')
  assert.equal(buttonWidget.pressed, true)
  assert.equal(buttonWidget.globalNodeId, null)
  assert.ok(buttonWidget.callbackFunctionId)
  const workspace = deserializeWorkspace(JSON.stringify({
    application: 'Sapphire 3',
    workspaceVersion: workspaceFileVersion,
    project,
    presentation: { cards, camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null },
  }))
  const card = workspace.presentation.cards.find((entry) => entry.id === button.module.id)
  assert.equal(card.type, 'holdButton')
  assert.equal(card.pressed, true)
})

test('exemple Simple → Input : les deux boutons appellent leur fonction liée', async () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === 'buttonLed').build()))
  assert.deepEqual(analyzeProgram(workspace.project).diagnostics, [])
  const toggleCard = workspace.presentation.cards.find((card) => card.type === 'toggleButton')
  const holdCard = workspace.presentation.cards.find((card) => card.type === 'holdButton')
  assert.ok(toggleCard)
  assert.ok(holdCard)
  assert.equal(inputButtonCallbackId(workspace.project, toggleCard.id), 'inputToggleSet')
  assert.equal(inputButtonCallbackId(workspace.project, holdCard.id), 'inputHoldSet')
  assert.equal(workspace.project.modules.some((module) => module.exports.some((entry) => entry.name === 'isPress')), false)
  assert.deepEqual(simulateProgram(workspace.project).output, ['Two buttons and an LED'])
  assert.equal(simulateProgram(workspace.project).leds.inputLed.value, false)

  const toggleNodeId = inputButtonOnClickNodeId(workspace.project, toggleCard.id)
  const holdNodeId = inputButtonOnClickNodeId(workspace.project, holdCard.id)
  const frames = []
  const result = await runLiveProgram(workspace.project, {
    sliceSteps: 20,
    onFrame: (state) => {
      frames.push(state)
      if (frames.length === 1) return { events: [{ nodeId: toggleNodeId, value: true }] }
      if (frames.length === 3) return { events: [{ nodeId: toggleNodeId, value: false }] }
      if (frames.length === 5) return { events: [{ nodeId: holdNodeId, value: true }] }
      if (frames.length >= 7) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.ok(frames.some((frame) => frame.leds.inputLed?.value === true))
  assert.equal(frames.at(-1).leds.inputLed.value, true)
})
