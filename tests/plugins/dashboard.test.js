import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardDocument, dashboardDefaultLayout } from '../../src/utils/dashboardExport.js'
import { dashboardStatesAt } from '../../src/utils/dashboardExecution.js'
import { dashboardInitialStates, dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { createModule, createNode, createProject, simulateProgram } from '../../src/utils/logic/index.js'
import { simulate as simulateDashboard } from '../../src/dashboard/runtimeEntry.js'
import { formatPluginText, resolvePluginSource } from '../../src/utils/pluginWidgetView.js'
import { buildNativeProject, readExamplePlugin } from './fixtures.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Prépare un widget de plugin actif et sa carte de workspace.
function pluginWidgetFixture() {
  const plugin = readExamplePlugin('voltmeter')
  const entry = {
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    author: plugin.author,
    widget: plugin.widgets[0],
  }
  const card = {
    id: 'plugin-card',
    type: 'pluginWidget',
    name: 'Digital voltmeter',
    pluginId: plugin.id,
    widgetId: 'voltmeter',
    pluginVersion: plugin.version,
    x: 0,
    y: 0,
    width: 360,
    height: 250,
    properties: { unit: 'V' },
    state: { value: 0, setpoint: 5 },
    bindings: { inputs: { value: 'temperature' }, outputs: { setpoint: 'callback-node' } },
    expandedNodeIds: [],
  }
  return { plugin, entry, card }
}

// Extrait la configuration JSON embarquée dans un dashboard exporté.
function dashboardData(html) {
  const match = html.match(/<script id="sapphire-dashboard-data" type="application\/json">([\s\S]*?)<\/script>/)
  assert.ok(match)
  return JSON.parse(match[1])
}

test('dashboard plugin : widget actif, définition et disposition', () => {
  const { plugin, entry, card } = pluginWidgetFixture()
  const widgets = dashboardWidgets({ modules: [], nodes: [] }, [card], { pluginWidgets: [entry] })
  assert.equal(widgets.length, 1)
  const widget = widgets[0]
  assert.equal(widget.type, 'pluginWidget')
  assert.equal(widget.missing, false)
  assert.equal(widget.definition.id, 'voltmeter')
  assert.equal(widget.properties.unit, 'V')
  assert.equal(widget.bindings.inputs.value, 'temperature')
  assert.equal(widget.bindings.outputs.setpoint, 'callback-node')
  const layout = dashboardDefaultLayout(widgets)
  assert.ok(layout.some((panel) => panel.id === card.id))
  const initial = dashboardInitialStates(widgets)
  assert.deepEqual(initial.variables, {})

  const html = buildDashboardDocument({
    name: 'Plugin dashboard',
    widgets,
    initialStates: initial,
    layout,
    plugins: [plugin],
    project: { formatVersion: 1, id: 'p', modules: [], nodes: [] },
    language: 'en',
  })
  const data = dashboardData(html)
  assert.equal(data.widgets[0].definition.id, 'voltmeter')
  assert.equal(data.plugins[0].id, plugin.id)
  assert.match(html, /db-plugin-widget/)
})

test('dashboard plugin : dépendance manquante conservée et signalée', () => {
  const { card } = pluginWidgetFixture()
  const widgets = dashboardWidgets({ modules: [], nodes: [] }, [card])
  assert.equal(widgets.length, 1)
  assert.equal(widgets[0].missing, true)
  assert.equal(widgets[0].definition, null)
  assert.equal(widgets[0].bindings.inputs.value, 'temperature')
  const html = buildDashboardDocument({ name: 'Missing plugin', widgets, language: 'en' })
  const data = dashboardData(html)
  assert.equal(data.widgets[0].missing, true)
  assert.match(html, /db-plugin-widget--missing|pluginWidget/)
})

test('dashboard plugin : variables capturées au pas et rendu des sources', () => {
  let project = createProject('dashboard-variables')
  project = { ...project, modules: [createModule('app', 'App')] }
  project.modules[0].rootNodeIds.push('main')
  project.nodes.push(
    createNode('main', 'app', 'FunctionDeclaration', { properties: { name: 'main', type: voidType, entryPoint: true }, children: { parameters: [], body: 'body' }, references: {} }),
    createNode('body', 'app', 'Block', { properties: {}, children: { statements: ['temperature', 'print'] }, references: {} }),
    createNode('temperature', 'app', 'VariableDeclaration', { properties: { name: 'temperature', type: intType }, children: { initializer: 'value' }, references: {} }),
    createNode('value', 'app', 'Literal', { properties: { type: intType, value: 42 }, children: {}, references: {} }),
    createNode('print', 'app', 'PrintStatement', { properties: {}, children: { value: 'temperatureRef' }, references: {} }),
    createNode('temperatureRef', 'app', 'Reference', { properties: {}, children: {}, references: { target: { kind: 'name', name: 'temperature' } } }),
  )
  const result = simulateProgram(project, { capturePluginVariables: ['temperature'] })
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.variableFrames))
  assert.equal(result.variableFrames.at(-1).temperature, 42)
  const states = dashboardStatesAt(result, result.trace.length - 1, { variables: {} })
  assert.equal(states.variables.temperature, 42)
  assert.equal(resolvePluginSource('input.value', { instance: { state: { value: 3 }, properties: {} }, inputs: { value: 9 } }), 9)
  assert.equal(resolvePluginSource('input.value', { instance: { state: { value: 3 }, properties: {} }, inputs: {} }), 3)
  assert.equal(formatPluginText('{property.unit} {state.value}', { instance: { state: { value: 3 }, properties: { unit: 'V' } }, inputs: {} }), 'V 3')
})

test('dashboard plugin : le runtime borné revalide et exécute les opérations natives', () => {
  const plugin = readExamplePlugin('clamp')
  const project = buildNativeProject('pluginClamp')
  const result = simulateDashboard(project, { plugins: [plugin], maxSteps: 1000 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['5'])
  const withoutPlugin = simulateDashboard(project, { maxSteps: 1000 })
  assert.equal(withoutPlugin.ok, false)
  assert.equal(withoutPlugin.errorCode, 'SIMULATION_DIAGNOSTICS')
})
