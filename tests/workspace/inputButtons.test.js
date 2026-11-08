import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { createInputButtonModule, inputButtonGlobalName } from '../../src/utils/inputButtonNode.js'
import { collectInputButtonValues, inputButtonNodeId } from '../../src/utils/logic/inputButtonState.js'
import { examples } from '../../src/utils/examples.js'
import { dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { deserializeWorkspace, workspaceFileVersion } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

// Construit un projet minimal : un bouton exporte `isPress`, App l'importe et l'affiche.
function inputProject(mode = 'toggle') {
  const project = createProject('inputTest')
  const button = createInputButtonModule('inputButton', 'Test button', 1, { mode })
  project.modules.push(button.module)
  project.nodes.push(...button.nodes)
  const app = createModule('inputApp', 'Input app')
  project.modules.push(app)
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `inputTest:app:${++sequence}`
    nodes.push(createNode(id, app.id, kind, { properties, children, references }))
    return id
  }
  const getter = button.module.exports.find((entry) => entry.name === 'isPress')
  const importId = 'inputApp:import:isPress'
  app.imports.push({ id: importId, moduleId: button.module.id, nodeId: getter.nodeId, localName: 'isPress' })
  const callee = node('Reference', {}, {}, { target: { kind: 'import', importId } })
  const call = node('CallExpression', {}, { callee, arguments: [] })
  const print = node('PrintStatement', {}, { value: call })
  const body = node('Block', {}, { statements: [print] })
  const main = node('FunctionDeclaration', { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, { parameters: [], body })
  app.rootNodeIds.push(main)
  project.nodes.push(...nodes)
  const globalNodeId = button.nodes.find((entry) => entry.properties?.name === inputButtonGlobalName(1)).id
  return { project, button, app, globalNodeId }
}

// Produit les cartes de présentation minimales pour un projet de test.
function inputCards(button, app, pressed = false) {
  const type = button.module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton'
  return [
    { id: button.module.id, type, name: button.module.name, x: 0, y: 0, width: 280, height: 190, expandedNodeIds: [], pressed },
    { id: app.id, type: 'module', name: app.name, x: 600, y: 0, width: 520, height: 420, expandedNodeIds: [] },
  ]
}

test('boutons d’entrée : modes toggle et hold, globale booléenne exportée', () => {
  for (const mode of ['toggle', 'hold']) {
    const { project, button, globalNodeId } = inputProject(mode)
    assert.equal(button.module.inputButton.mode, mode)
    assert.equal(button.module.exports.some((entry) => entry.name === 'isPress'), true)
    assert.deepEqual(analyzeProgram(project).diagnostics, [])
    assert.deepEqual(simulateProgram(project).output, ['false'])
    assert.deepEqual(simulateProgram(project, { inputs: { [globalNodeId]: true } }).output, ['true'])
    assert.deepEqual(simulateProgram(project, { inputs: { [globalNodeId]: false } }).output, ['false'])
    assert.equal(transpileProgram(project).code, 'TRANSPILE_INPUT_BUTTON_UNSUPPORTED')
  }
})

test('boutons d’entrée : collecte, dashboard et relecture du workspace', () => {
  const { project, button, app, globalNodeId } = inputProject('hold')
  const cards = inputCards(button, app, true)
  assert.deepEqual(collectInputButtonValues(project, cards), { [globalNodeId]: true })
  const widgets = dashboardWidgets(project, cards)
  assert.equal(widgets.length, 1)
  assert.equal(widgets[0].type, 'holdButton')
  assert.equal(widgets[0].mode, 'hold')
  assert.equal(widgets[0].pressed, true)
  assert.equal(widgets[0].globalNodeId, globalNodeId)
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

test('exemple Simple → Input : deux boutons pilotent la LED', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === 'buttonLed').build()))
  assert.deepEqual(analyzeProgram(workspace.project).diagnostics, [])
  const toggleCard = workspace.presentation.cards.find((card) => card.type === 'toggleButton')
  const holdCard = workspace.presentation.cards.find((card) => card.type === 'holdButton')
  assert.ok(toggleCard)
  assert.ok(holdCard)
  const toggleId = inputButtonNodeId(workspace.project, toggleCard.id)
  const holdId = inputButtonNodeId(workspace.project, holdCard.id)
  const off = simulateProgram(workspace.project)
  assert.deepEqual(off.output, ['false'])
  assert.equal(off.leds.inputLed.value, false)
  const toggleOn = simulateProgram(workspace.project, { inputs: { [toggleId]: true, [holdId]: false } })
  assert.deepEqual(toggleOn.output, ['true'])
  assert.equal(toggleOn.leds.inputLed.value, true)
  const holdOn = simulateProgram(workspace.project, { inputs: { [toggleId]: false, [holdId]: true } })
  assert.deepEqual(holdOn.output, ['true'])
  assert.equal(holdOn.leds.inputLed.value, true)
})
