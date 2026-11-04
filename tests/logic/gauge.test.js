import test from 'node:test'
import assert from 'node:assert/strict'
import { createGaugeModule } from '../../src/utils/gaugeNode.js'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { readGaugeStates } from '../../src/utils/logic/gaugeState.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose un projet : une jauge cachée et un module normal qui la pilote.
function gaugeProject() {
  const gauge = createGaugeModule('g1', 'Gauge', 1, { min: 0, max: 100 })
  const project = createProject('p')
  project.modules.push(gauge.module)
  project.nodes.push(...gauge.nodes)
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
  const literal = (id, value) => add(id, 'Literal', { type: doubleType, value: String(value) })

  app.rootNodeIds.push('main')
  add('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  add('body', 'Block', {}, { statements: ['setStatement', 'addStatement', 'printValue', 'printMin', 'printMax'] })
  call('set', 'setImport', [literal('setZero', 40)])
  call('add', 'addImport', [literal('addThirty', 30)])
  add('printValue', 'PrintStatement', {}, { value: 'getValueCall' })
  add('getValueCall', 'CallExpression', {}, { callee: 'getValueRef', arguments: [] })
  add('getValueRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'getValueImport' } })
  add('printMin', 'PrintStatement', {}, { value: 'getMinCall' })
  add('getMinCall', 'CallExpression', {}, { callee: 'getMinRef', arguments: [] })
  add('getMinRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'getMinImport' } })
  add('printMax', 'PrintStatement', {}, { value: 'getMaxCall' })
  add('getMaxCall', 'CallExpression', {}, { callee: 'getMaxRef', arguments: [] })
  add('getMaxRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'getMaxImport' } })

  const exported = (name) => gauge.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'setImport', moduleId: 'g1', nodeId: exported('GAUGE_SP3_SET_VALUE_1'), localName: 'setValue' },
    { id: 'addImport', moduleId: 'g1', nodeId: exported('GAUGE_SP3_ADD_VALUE_1'), localName: 'addValue' },
    { id: 'getValueImport', moduleId: 'g1', nodeId: exported('GAUGE_SP3_GET_VALUE_1'), localName: 'getValue' },
    { id: 'getMinImport', moduleId: 'g1', nodeId: exported('GAUGE_SP3_GET_MIN_1'), localName: 'getMin' },
    { id: 'getMaxImport', moduleId: 'g1', nodeId: exported('GAUGE_SP3_GET_MAX_1'), localName: 'getMax' },
  )
  return project
}

test('jauge : le module caché exporte les fonctions de contrôle', () => {
  const gauge = createGaugeModule('g2', 'Gauge', 2, { min: -10, max: 10 })
  assert.deepEqual(gauge.module.exports.map((entry) => entry.name), [
    'GAUGE_SP3_SET_VALUE_2', 'GAUGE_SP3_ADD_VALUE_2', 'GAUGE_SP3_GET_VALUE_2',
    'GAUGE_SP3_GET_MIN_2', 'GAUGE_SP3_GET_MAX_2', 'GAUGE_SP3_SET_RANGE_2', 'GAUGE_SP3_RESET_2',
  ])
  assert.deepEqual(gauge.module.gauge, { index: 2, min: -10, max: 10 })
  const globals = gauge.nodes.filter((node) => node.kind === 'VariableDeclaration').map((node) => node.properties.name)
  assert.deepEqual(globals, ['GAUGE_SP3_GLOBAL_VALUE_2', 'GAUGE_SP3_GLOBAL_MIN_2', 'GAUGE_SP3_GLOBAL_MAX_2'])
})

test('jauge : pilotée depuis un autre module, avec état lu depuis la simulation', () => {
  const project = gaugeProject()
  const analysis = analyzeProgram(project)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['70', '0', '100'])
  assert.deepEqual(result.gauges.g1, { value: 70, min: 0, max: 100 })
  // Un état par pas, aligné sur la trace.
  assert.equal(result.gaugeFrames.length, result.trace.length)
  const values = result.gaugeFrames.map((frame) => frame.g1?.value).filter((value) => value !== undefined)
  assert.ok(values.includes(40))
  assert.ok(values.includes(70))
})

test('jauge : un état absent de la simulation ne produit aucune valeur', () => {
  const project = createProject('p')
  const gauge = createGaugeModule('g3', 'Gauge', 3, {})
  project.modules.push(gauge.module)
  project.nodes.push(...gauge.nodes)
  assert.deepEqual(readGaugeStates(project, new Map()), {})
})