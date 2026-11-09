import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, bindColorPickerCallback, getUnusedDeclarationIds } from '../../src/utils/logic/index.js'
import { runLiveProgram } from '../../src/utils/logic/liveSimulation.js'
import { createColorPickerModule } from '../../src/utils/colorPickerNode.js'
import { colorPickerCallbackId, colorPickerDefaults, colorPickerOnChangeBinding, colorPickerOnChangeNodeId, normalizeColorValue } from '../../src/utils/logic/colorPickerState.js'
import { dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { buildDashboardDocument, dashboardDefaultLayout } from '../../src/utils/dashboardExport.js'
import { deserializeWorkspace, serializeWorkspace } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const intType = { kind: 'primitive', name: 'int' }
const intArrayType = { kind: 'array', elementType: intType }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const stringType = { kind: 'primitive', name: 'string' }

// Construit un sélecteur et une fonction onChange(int[]) qui imprime chaque canal.
function pickerProject({ bind = true, channels = 3 } = {}) {
  const project = createProject('colorPickerTest')
  const picker = createColorPickerModule('colorPicker', 'Color picker', 1, { channels })
  project.modules.push(picker.module)
  project.nodes.push(...picker.nodes)
  const app = createModule('colorApp', 'Color app')
  project.modules.push(app)
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `colorTest:app:${++sequence}`
    nodes.push(createNode(id, app.id, kind, { properties, children, references }))
    return id
  }

  // function onColor(value: int[]): void { Print(value[0]); ... }
  const parameter = node('Parameter', { name: 'value', type: intArrayType })
  const statements = []
  for (let index = 0; index < channels; index += 1) {
    const array = node('Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
    const arrayIndex = node('Literal', { type: intType, value: String(index) })
    const access = node('ArrayAccess', {}, { array, index: arrayIndex })
    statements.push(node('PrintStatement', {}, { value: access }))
  }
  const callbackBody = node('Block', {}, { statements })
  const callback = node('FunctionDeclaration', { name: 'onColor', type: voidType }, { parameters: [parameter], body: callbackBody })
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

  const bound = bind ? bindColorPickerCallback(project, picker.module.id, callback) : { ok: true, project }
  return {
    project: bound.project,
    picker,
    app,
    callbackId: callback,
    onChangeNodeId: colorPickerOnChangeNodeId(bound.project, picker.module.id),
  }
}

// Produit les cartes de présentation minimales pour un sélecteur.
function pickerCards(picker, app, value, view = undefined) {
  const type = picker.module.colorPicker.channels === 4 ? 'rgbaPicker' : 'rgbPicker'
  return [
    { id: picker.module.id, type, name: picker.module.name, x: 0, y: 0, width: 420, height: 460, expandedNodeIds: [], value, ...(view ? { colorPickerView: view } : {}) },
    { id: app.id, type: 'module', name: app.name, x: 600, y: 0, width: 520, height: 420, expandedNodeIds: [] },
  ]
}

test('sélecteurs RGB et RGBA : valeurs normalisées et valeurs par défaut', () => {
  assert.deepEqual(colorPickerDefaults(3), [255, 213, 71])
  assert.deepEqual(colorPickerDefaults(4), [255, 213, 71, 255])
  assert.deepEqual(normalizeColorValue([1, 2, 300, -1], 4), [1, 2, 71, 255])
  assert.deepEqual(normalizeColorValue('bad', 3), [255, 213, 71])
})

test('sélecteur RGB : onChange(int[]) lié, live, dashboard, workspace et refus de transpilation', async () => {
  const { project, picker, app, callbackId, onChangeNodeId } = pickerProject({ channels: 3 })
  assert.equal(picker.module.colorPicker.channels, 3)
  assert.equal(colorPickerCallbackId(project, picker.module.id), callbackId)
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const unused = getUnusedDeclarationIds(project)
  assert.equal(unused.includes(onChangeNodeId), false)
  assert.equal(unused.some((id) => /^(RGB|RGBA)_PICKER_SP3_GLOBAL_NOOP_/.test(project.nodes.find((node) => node.id === id)?.properties?.name ?? '')), false)
  assert.equal(transpileProgram(project).code, 'TRANSPILE_RGB_PICKER_UNSUPPORTED')

  const frames = []
  const result = await runLiveProgram(project, {
    sliceSteps: 20,
    onFrame: (state) => {
      frames.push(state)
      if (frames.length === 1) return { events: [{ nodeId: onChangeNodeId, value: [10, 20, 30] }] }
      if (frames.length >= 5) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.ok(['10', '20', '30'].every((entry) => frames.some((frame) => frame.output.includes(entry))))

  const value = [12, 34, 56]
  const cards = pickerCards(picker, app, value, 'code')
  const widget = dashboardWidgets(project, cards).find((entry) => entry.id === picker.module.id)
  assert.equal(widget.type, 'rgbPicker')
  assert.equal(widget.channels, 3)
  assert.deepEqual(widget.value, value)
  assert.ok(widget.callbackFunctionId)
  assert.ok(widget.onChangeNodeId)

  const workspace = deserializeWorkspace(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
  const card = workspace.presentation.cards.find((entry) => entry.id === picker.module.id)
  assert.equal(card.type, 'rgbPicker')
  assert.deepEqual(card.value, value)
  assert.equal(card.colorPickerView, 'code')
})

test('sélecteur RGBA : quatre canaux, callback et refus spécifique', async () => {
  const { project, picker, app, callbackId, onChangeNodeId } = pickerProject({ channels: 4 })
  assert.equal(picker.module.colorPicker.channels, 4)
  assert.equal(colorPickerCallbackId(project, picker.module.id), callbackId)
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  assert.equal(transpileProgram(project).code, 'TRANSPILE_RGBA_PICKER_UNSUPPORTED')

  const frames = []
  const result = await runLiveProgram(project, {
    sliceSteps: 20,
    onFrame: (state) => {
      frames.push(state)
      if (frames.length === 1) return { events: [{ nodeId: onChangeNodeId, value: [1, 2, 3, 4] }] }
      if (frames.length >= 5) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.ok(['1', '2', '3', '4'].every((entry) => frames.some((frame) => frame.output.includes(entry))))

  const value = [10, 20, 30, 128]
  const cards = pickerCards(picker, app, value)
  const widget = dashboardWidgets(project, cards).find((entry) => entry.id === picker.module.id)
  assert.equal(widget.type, 'rgbaPicker')
  assert.equal(widget.channels, 4)
  assert.deepEqual(widget.value, value)

  const workspace = deserializeWorkspace(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
  const card = workspace.presentation.cards.find((entry) => entry.id === picker.module.id)
  assert.equal(card.type, 'rgbaPicker')
  assert.deepEqual(card.value, value)
})

test('sélecteur : binding importé puis retiré', () => {
  const { project, picker, callbackId } = pickerProject({ bind: false })
  assert.equal(colorPickerCallbackId(project, picker.module.id), null)
  assert.equal(colorPickerOnChangeBinding(project, picker.module.id).target.kind, 'name')

  const bound = bindColorPickerCallback(project, picker.module.id, callbackId)
  assert.equal(bound.ok, true)
  assert.equal(colorPickerCallbackId(bound.project, picker.module.id), callbackId)
  const binding = colorPickerOnChangeBinding(bound.project, picker.module.id)
  assert.equal(binding.target.kind, 'import')
  const module = bound.project.modules.find((entry) => entry.id === picker.module.id)
  assert.equal(module.imports.some((entry) => entry.id === binding.importId), true)
  assert.deepEqual(analyzeProgram(bound.project).diagnostics, [])

  const unbound = bindColorPickerCallback(bound.project, picker.module.id, null)
  assert.equal(unbound.ok, true)
  assert.equal(colorPickerCallbackId(unbound.project, picker.module.id), null)
  assert.equal(unbound.project.modules.find((entry) => entry.id === picker.module.id).imports.some((entry) => entry.id === binding.importId), false)
})

test('sélecteurs : le dashboard exporté embarque les deux types', () => {
  for (const [channels, type, value] of [[3, 'rgbPicker', [12, 34, 56]], [4, 'rgbaPicker', [12, 34, 56, 128]]]) {
    const { project, picker, app } = pickerProject({ channels })
    const cards = pickerCards(picker, app, value)
    const widgets = dashboardWidgets(project, cards)
    const html = buildDashboardDocument({ name: 'Colors', widgets, layout: dashboardDefaultLayout(widgets), project })
    assert.match(html, new RegExp(`"type":"${type}"`))
    assert.match(html, new RegExp(`"channels":${channels}`))
  }
})

test('sélecteur : une fonction booléenne est refusée', () => {
  const project = createProject('colorTypeTest')
  const picker = createColorPickerModule('colorPicker', 'Color picker', 1, { channels: 3 })
  project.modules.push(picker.module)
  project.nodes.push(...picker.nodes)
  const app = createModule('colorApp', 'Color app')
  project.modules.push(app)
  const parameter = createNode('colorTest:bool:1', app.id, 'Parameter', { properties: { name: 'value', type: booleanType } })
  const body = createNode('colorTest:bool:2', app.id, 'Block', { properties: {}, children: { statements: [] } })
  const callback = createNode('colorTest:bool:3', app.id, 'FunctionDeclaration', { properties: { name: 'onBool', type: voidType }, children: { parameters: [parameter.id], body: body.id } })
  app.rootNodeIds.push(callback.id)
  project.nodes.push(parameter, body, callback)
  const bound = bindColorPickerCallback(project, picker.module.id, callback.id)
  assert.equal(bound.ok, false)
  assert.equal(bound.code, 'COLOR_PICKER_CALLBACK_TYPE')
})
