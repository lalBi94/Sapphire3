import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, bindInputNumberCallback, simulateProgram, getUnusedDeclarationIds } from '../../src/utils/logic/index.js'
import { runLiveProgram } from '../../src/utils/logic/liveSimulation.js'
import { createInputNumberModule } from '../../src/utils/inputNumberNode.js'
import { inputNumberCallbackId, inputNumberOnChangeBinding, inputNumberOnChangeNodeId } from '../../src/utils/logic/inputNumberState.js'
import { dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { deserializeWorkspace, serializeWorkspace } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const intType = { kind: 'primitive', name: 'int' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const stringType = { kind: 'primitive', name: 'string' }

// Construit une entrée numérique et une fonction onChange(int) qui imprime la valeur.
function numberProject({ bind = true, valueType = 'int' } = {}) {
  const project = createProject('numberInputTest')
  const input = createInputNumberModule('numberInput', 'Number input', 1, { valueType })
  project.modules.push(input.module)
  project.nodes.push(...input.nodes)
  const app = createModule('numberApp', 'Number app')
  project.modules.push(app)
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `numberTest:app:${++sequence}`
    nodes.push(createNode(id, app.id, kind, { properties, children, references }))
    return id
  }

  // function onChange(value: type): void { Print(value); }
  const valuePrimitive = { kind: 'primitive', name: valueType }
  const parameter = node('Parameter', { name: 'value', type: valuePrimitive })
  const argument = node('Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  const print = node('PrintStatement', {}, { value: argument })
  const callbackBody = node('Block', {}, { statements: [print] })
  const callback = node('FunctionDeclaration', { name: 'onChange', type: voidType }, { parameters: [parameter], body: callbackBody })
  app.rootNodeIds.push(callback)

  // main: Print("ready"); while SP3_LIVE { }
  const ready = node('Literal', { type: stringType, value: 'ready' })
  const printReady = node('PrintStatement', {}, { value: ready })
  const flagValue = node('Literal', { type: booleanType, value: false })
  const flag = node('VariableDeclaration', { name: 'SP3_LIVE', type: booleanType }, { initializer: flagValue })
  const test = node('Reference', {}, {}, { target: { kind: 'name', name: 'SP3_LIVE' } })
  const loopBody = node('Block', {}, { statements: [] })
  const loop = node('WhileStatement', {}, { test, body: loopBody })
  const mainBody = node('Block', {}, { statements: [printReady, loop] })
  const main = node('FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: mainBody })
  app.rootNodeIds.push(flag, main)
  project.nodes.push(...nodes)

  const bound = bind ? bindInputNumberCallback(project, input.module.id, callback) : { ok: true, project }
  return {
    project: bound.project,
    input,
    app,
    callbackId: callback,
    onChangeNodeId: inputNumberOnChangeNodeId(bound.project, input.module.id),
  }
}

// Produit les cartes de présentation minimales pour un projet de test.
function numberCards(input, app, value = 0, view = undefined, type = 'numberInput') {
  return [
    { id: input.module.id, type, name: input.module.name, x: 0, y: 0, width: 300, height: 210, expandedNodeIds: [], value, ...(view ? { inputNumberView: view } : {}) },
    { id: app.id, type: 'module', name: app.name, x: 600, y: 0, width: 520, height: 420, expandedNodeIds: [] },
  ]
}

test('entrée numérique : onChange(int) lié, sans export et sans déclaration inutilisée', () => {
  const { project, input, callbackId, onChangeNodeId } = numberProject()
  assert.equal(input.module.inputNumber.index, 1)
  assert.equal(input.module.exports.length, 0)
  assert.ok(onChangeNodeId)
  assert.equal(inputNumberCallbackId(project, input.module.id), callbackId)
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const unused = getUnusedDeclarationIds(project)
  assert.equal(unused.includes(onChangeNodeId), false)
  assert.equal(unused.some((id) => project.nodes.find((node) => node.id === id)?.properties?.name?.startsWith('INPUT_SP3_GLOBAL_NOOP_')), false)
  assert.deepEqual(simulateProgram(project).output, ['ready'])
  assert.equal(transpileProgram(project).code, 'TRANSPILE_INPUT_NUMBER_UNSUPPORTED')
})

test('entrée numérique : binding importé puis retiré', () => {
  const { project, input, callbackId } = numberProject({ bind: false })
  assert.equal(inputNumberCallbackId(project, input.module.id), null)
  assert.equal(inputNumberOnChangeBinding(project, input.module.id).target.kind, 'name')

  const bound = bindInputNumberCallback(project, input.module.id, callbackId)
  assert.equal(bound.ok, true)
  assert.equal(inputNumberCallbackId(bound.project, input.module.id), callbackId)
  const binding = inputNumberOnChangeBinding(bound.project, input.module.id)
  assert.equal(binding.target.kind, 'import')
  const module = bound.project.modules.find((entry) => entry.id === input.module.id)
  assert.equal(module.imports.some((entry) => entry.id === binding.importId), true)
  assert.deepEqual(analyzeProgram(bound.project).diagnostics, [])

  const unbound = bindInputNumberCallback(bound.project, input.module.id, null)
  assert.equal(unbound.ok, true)
  assert.equal(inputNumberCallbackId(unbound.project, input.module.id), null)
  const unboundModule = unbound.project.modules.find((entry) => entry.id === input.module.id)
  assert.equal(unboundModule.imports.some((entry) => entry.id === binding.importId), false)
  assert.deepEqual(analyzeProgram(unbound.project).diagnostics, [])
})

test('entrée numérique : un événement live transmet l’entier au callback', async () => {
  const { project, onChangeNodeId } = numberProject()
  const frames = []
  const result = await runLiveProgram(project, {
    sliceSteps: 20,
    onFrame: (state) => {
      frames.push(state)
      if (frames.length === 1) return { events: [{ nodeId: onChangeNodeId, value: 42 }] }
      if (frames.length >= 5) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.stopped, true)
  assert.ok(frames.some((frame) => frame.output.includes('42')))
})

test('entrée numérique : dashboard, valeur et vue conservées dans le workspace', () => {
  const { project, input, app } = numberProject()
  const cards = numberCards(input, app, 7, 'code')
  const widgets = dashboardWidgets(project, cards)
  const widget = widgets.find((entry) => entry.id === input.module.id)
  assert.equal(widget.type, 'numberInput')
  assert.equal(widget.value, 7)
  assert.ok(widget.callbackFunctionId)
  assert.ok(widget.onChangeNodeId)

  const workspace = deserializeWorkspace(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
  const card = workspace.presentation.cards.find((entry) => entry.id === input.module.id)
  assert.equal(card.type, 'numberInput')
  assert.equal(card.value, 7)
  assert.equal(card.inputNumberView, 'code')
})

test('entrées décimale et texte : binding, live, dashboard et workspace', async () => {
  for (const [valueType, cardType, value, code] of [
    ['float', 'floatInput', 3.5, 'TRANSPILE_INPUT_NUMBER_UNSUPPORTED'],
    ['string', 'stringInput', 'hello', 'TRANSPILE_INPUT_STRING_UNSUPPORTED'],
  ]) {
    const { project, input, app, callbackId, onChangeNodeId } = numberProject({ valueType })
    assert.equal(input.module.inputNumber.valueType, valueType)
    assert.equal(inputNumberCallbackId(project, input.module.id), callbackId)
    assert.deepEqual(analyzeProgram(project).diagnostics, [])
    assert.equal(transpileProgram(project).code, code)

    const frames = []
    const result = await runLiveProgram(project, {
      sliceSteps: 20,
      onFrame: (state) => {
        frames.push(state)
        if (frames.length === 1) return { events: [{ nodeId: onChangeNodeId, value }] }
        if (frames.length >= 5) return { stop: true }
        return {}
      },
    })
    assert.equal(result.ok, true)
    assert.ok(frames.some((frame) => frame.output.includes(String(value))))

    const cards = numberCards(input, app, value, 'code', cardType)
    const widget = dashboardWidgets(project, cards).find((entry) => entry.id === input.module.id)
    assert.equal(widget.type, cardType)
    assert.equal(widget.valueType, valueType)
    assert.equal(widget.value, value)

    const workspace = deserializeWorkspace(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
    const card = workspace.presentation.cards.find((entry) => entry.id === input.module.id)
    assert.equal(card.type, cardType)
    assert.equal(card.value, value)
    assert.equal(card.inputNumberView, 'code')
  }
})

test('entrée numérique : une fonction booléenne est refusée', () => {
  const project = createProject('numberTypeTest')
  const input = createInputNumberModule('numberInput', 'Number input', 1)
  project.modules.push(input.module)
  project.nodes.push(...input.nodes)
  const app = createModule('numberApp', 'Number app')
  project.modules.push(app)
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}) => {
    const id = `numberTest:bool:${++sequence}`
    nodes.push(createNode(id, app.id, kind, { properties, children }))
    return id
  }
  const parameter = node('Parameter', { name: 'value', type: booleanType })
  const body = node('Block', {}, { statements: [] })
  const callback = node('FunctionDeclaration', { name: 'onBool', type: voidType }, { parameters: [parameter], body })
  app.rootNodeIds.push(callback)
  project.nodes.push(...nodes)
  const bound = bindInputNumberCallback(project, input.module.id, callback)
  assert.equal(bound.ok, false)
  assert.equal(bound.code, 'INPUT_NUMBER_CALLBACK_TYPE')
})
