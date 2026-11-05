import test from 'node:test'
import assert from 'node:assert/strict'
import { createBarChartModule, barChartDefaults } from '../../src/utils/barChartNode.js'
import { createHeatmapModule } from '../../src/utils/heatmapNode.js'
import { createScreenModule } from '../../src/utils/screenNode.js'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, createDebugSession, simulateProgram } from '../../src/utils/logic/index.js'
import { barChartGlobalName, readBarChartStates, maximumBarChartBars } from '../../src/utils/logic/barChartState.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }

// Compose un projet : un graphique caché et un module normal qui le pilote.
function barChartProject(mode = 'values') {
  const barChart = createBarChartModule('b1', 'Bar chart', 1, { size: 4 })
  const project = createProject('p')
  project.modules.push(barChart.module)
  project.nodes.push(...barChart.nodes)
  const app = createModule('app', 'App')
  project.modules.push(app)

  const add = (id, kind, properties = {}, children = {}, references = {}) => {
    project.nodes.push(createNode(id, 'app', kind, { properties, children, references }))
    return id
  }
  const call = (prefix, importId, args) => {
    add(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    add(`${prefix}Call`, 'CallExpression', {}, { callee: `${prefix}Callee`, arguments: args })
    add(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
    return `${prefix}Statement`
  }
  const intValue = (id, value) => add(id, 'Literal', { type: intType, value: String(value) })
  const arrayLiteral = (id, values) => add(id, 'ArrayLiteral', { elementType: intType }, {
    elements: values.map((value, index) => intValue(`${id}Value${index}`, value)),
  })

  app.rootNodeIds.push('main')
  add('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  const statements = [call('set', 'setImport', [intValue('setIndex', 1), intValue('setValue', 42)]), call('data', 'dataImport', [arrayLiteral('dataList', [7, 8, 9])])]
  if (mode === 'values') statements.push(call('last', 'setImport', [intValue('lastIndex', 0), intValue('lastValue', 5)]))
  if (mode === 'clear') statements.push(call('clear', 'clearImport', []))
  add('body', 'Block', {}, { statements })

  const exported = (name) => barChart.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'setImport', moduleId: 'b1', nodeId: exported('BARCHART_SP3_SET_VALUE_1'), localName: 'setValue' },
    { id: 'dataImport', moduleId: 'b1', nodeId: exported('BARCHART_SP3_SET_DATA_1'), localName: 'setData' },
    { id: 'clearImport', moduleId: 'b1', nodeId: exported('BARCHART_SP3_CLEAR_1'), localName: 'clear' },
  )
  return project
}

test('graphique à barres : le module caché exporte les trois fonctions attendues', () => {
  const barChart = createBarChartModule('b2', 'Bar chart', 2)
  assert.deepEqual(barChart.module.exports.map((entry) => entry.name), [
    'BARCHART_SP3_SET_VALUE_2', 'BARCHART_SP3_SET_DATA_2', 'BARCHART_SP3_CLEAR_2',
  ])
  assert.deepEqual(barChart.module.barChart, { index: 2 })
  const data = barChart.nodes.find((node) => node.kind === 'VariableDeclaration')
  assert.equal(data.properties.name, 'BARCHART_SP3_GLOBAL_DATA_2')
  assert.deepEqual(data.properties.type, intArrayType)
  const initializer = barChart.nodes.find((node) => node.id === data.children.initializer)
  assert.equal(initializer.kind, 'ArrayLiteral')
  assert.equal(initializer.children.elements.length, barChartDefaults.size)
})

test('graphique à barres : SET_VALUE et SET_DATA mettent à jour les valeurs et les frames', () => {
  const project = barChartProject('values')
  const analysis = analyzeProgram(project)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.barCharts.b1, { values: [5, 8, 9] })
  assert.equal(result.barChartFrames.length, result.trace.length)
  const snapshots = result.barChartFrames.map((frame) => frame.b1?.values).filter(Boolean)
  assert.ok(snapshots.some((values) => values.length === 4 && values[1] === 42))
  assert.ok(snapshots.some((values) => values.join(',') === '7,8,9'))
})

test('graphique à barres : CLEAR remet toutes les barres à zéro sans changer leur nombre', () => {
  const result = simulateProgram(barChartProject('clear'))
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.barCharts.b1, { values: [0, 0, 0] })
})

test('graphique à barres : le debug capture les valeurs par image', () => {
  const session = createDebugSession(barChartProject('values'))
  assert.equal(session.errorCode, null)
  assert.ok(session.frames.some((frame) => frame.barCharts?.b1?.values?.join(',') === '7,8,9'))
  assert.ok(session.frames.some((frame) => frame.barCharts?.b1?.values?.[0] === 5))
})

test('graphique à barres : la présence d’un graphique bloque la transpilation', () => {
  const result = transpileProgram(barChartProject('values'))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TRANSPILE_BAR_CHART_UNSUPPORTED')
})

test('graphique à barres : un état absent de la simulation ne produit aucune valeur', () => {
  const project = createProject('p')
  const barChart = createBarChartModule('b3', 'Bar chart', 3)
  project.modules.push(barChart.module)
  project.nodes.push(...barChart.nodes)
  assert.deepEqual(readBarChartStates(project, new Map()), {})
})

test('graphique à barres : indices invalides refusés, état partiel conservé', () => {
  for (const index of [-1, 4]) {
    const project = barChartProject()
    project.nodes.find((node) => node.id === 'setIndex').properties.value = String(index)
    const result = simulateProgram(project)
    assert.equal(result.errorCode, 'SIMULATION_ARRAY_BOUNDS')
    assert.deepEqual(result.barCharts.b1.values, [0, 0, 0, 0])
    assert.ok(result.barChartFrames.length > 0)
  }
})

test('graphique à barres : lecteur borné, signé, vide et indépendant du tableau runtime', () => {
  const project = barChartProject()
  const id = project.nodes.find((node) => node.properties?.name === barChartGlobalName('DATA', 1)).id
  const data = [-3n, 0n, 7n]
  const snapshot = readBarChartStates(project, new Map([[id, data]]))
  data[0] = 99n
  assert.deepEqual(snapshot.b1.values, [-3, 0, 7])
  assert.deepEqual(readBarChartStates(project, new Map([[id, []]])).b1.values, [])
  assert.deepEqual(readBarChartStates(project, new Map([[id, [Symbol()]]])), {})
  assert.equal(readBarChartStates(project, new Map([[id, Array(100).fill(1n)]])).b1.values.length, maximumBarChartBars)
})

test('widgets mixtes : BarChart suit les images Screen, Heatmap reste au pas seulement', () => {
  const project = barChartProject()
  const screen = createScreenModule('s', 'Screen', 1, { width: 2, height: 2 })
  const heatmap = createHeatmapModule('h', 'Heatmap', 1)
  project.modules.push(screen.module, heatmap.module)
  project.nodes.push(...screen.nodes, ...heatmap.nodes)
  const app = project.modules.find((module) => module.id === 'app')
  const present = screen.module.exports.find((entry) => entry.name === 'SCREEN_SP3_PRESENT_1')
  app.imports.push({ id: 'present', moduleId: 's', nodeId: present.nodeId, localName: 'present' })
  project.nodes.find((node) => node.id === 'body').children.statements.push('presentStatement')
  project.nodes.push(
    createNode('presentStatement', 'app', 'ExpressionStatement', { children: { expression: 'presentCall' } }),
    createNode('presentCall', 'app', 'CallExpression', { children: { callee: 'presentRef', arguments: [] } }),
    createNode('presentRef', 'app', 'Reference', { references: { target: { kind: 'import', importId: 'present' } } }),
  )
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.ok(result.screenFrames.length > 0)
  assert.equal(result.screenFrameBarCharts.length, result.screenFrames.length)
  assert.deepEqual(result.screenFrameBarCharts.at(-1).b1.values, [5, 8, 9])
  assert.equal(result.screenFrameHeatmaps, undefined)
  assert.equal(result.heatmapFrames.length, result.trace.length)
})
