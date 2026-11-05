import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgressModule } from '../../src/utils/progressNode.js'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, createDebugSession, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { readProgressStates } from '../../src/utils/logic/progressState.js'

const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose un projet : une barre cachée et un module normal qui la pilote.
function progressProject() {
  const progress = createProgressModule('p1', 'Progress', 1, { min: 0, max: 100 })
  const project = createProject('p')
  project.modules.push(progress.module)
  project.nodes.push(...progress.nodes)
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
  add('body', 'Block', {}, { statements: ['setStatement', 'addStatement', 'rangeStatement', 'printValue'] })
  call('set', 'setImport', [literal('setForty', 40)])
  call('add', 'addImport', [literal('addThirty', 30)])
  call('range', 'rangeImport', [literal('rangeMin', 0), literal('rangeMax', 200)])
  add('printValue', 'PrintStatement', {}, { value: 'getValueCall' })
  add('getValueCall', 'CallExpression', {}, { callee: 'getValueRef', arguments: [] })
  add('getValueRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'getValueImport' } })

  const exported = (name) => progress.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'setImport', moduleId: 'p1', nodeId: exported('PROGRESS_SP3_SET_VALUE_1'), localName: 'setValue' },
    { id: 'addImport', moduleId: 'p1', nodeId: exported('PROGRESS_SP3_ADD_VALUE_1'), localName: 'addValue' },
    { id: 'rangeImport', moduleId: 'p1', nodeId: exported('PROGRESS_SP3_SET_RANGE_1'), localName: 'setRange' },
    { id: 'getValueImport', moduleId: 'p1', nodeId: exported('PROGRESS_SP3_GET_VALUE_1'), localName: 'getValue' },
  )
  return project
}

test('barre de progression : le module caché exporte les quatre fonctions attendues', () => {
  const progress = createProgressModule('p2', 'Progress', 2, { min: -10, max: 10 })
  assert.deepEqual(progress.module.exports.map((entry) => entry.name), [
    'PROGRESS_SP3_SET_VALUE_2', 'PROGRESS_SP3_ADD_VALUE_2',
    'PROGRESS_SP3_GET_VALUE_2', 'PROGRESS_SP3_SET_RANGE_2',
  ])
  assert.deepEqual(progress.module.progress, { index: 2, min: -10, max: 10 })
  const globals = progress.nodes.filter((node) => node.kind === 'VariableDeclaration').map((node) => node.properties.name)
  assert.deepEqual(globals, ['PROGRESS_SP3_GLOBAL_VALUE_2', 'PROGRESS_SP3_GLOBAL_MIN_2', 'PROGRESS_SP3_GLOBAL_MAX_2'])
})

test('barre de progression : SET_RANGE corrige une plage inversée sans perdre les données', () => {
  const progress = createProgressModule('p3', 'Progress', 3, { min: 50, max: 20 })
  assert.deepEqual(progress.module.progress, { index: 3, min: 50, max: 100 })
})

test('barre de progression : pilotée depuis un autre module, avec état lu depuis la simulation', () => {
  const project = progressProject()
  const analysis = analyzeProgram(project)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['70'])
  assert.deepEqual(result.progresses.p1, { value: 70, min: 0, max: 200 })
  // Un état par pas, aligné sur la trace.
  assert.equal(result.progressFrames.length, result.trace.length)
  const values = result.progressFrames.map((frame) => frame.p1?.value).filter((value) => value !== undefined)
  assert.ok(values.includes(40))
  assert.ok(values.includes(70))
})

test('barre de progression : le debug capture un état par image', () => {
  const session = createDebugSession(progressProject())
  assert.equal(session.errorCode, null)
  assert.ok(session.frames.some((frame) => frame.progresses?.p1?.value === 40))
  assert.ok(session.frames.some((frame) => frame.progresses?.p1?.max === 200))
})

test('barre de progression : la présence d’une barre bloque la transpilation', () => {
  const result = transpileProgram(progressProject())
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TRANSPILE_PROGRESS_UNSUPPORTED')
})

test('barre de progression : un état absent de la simulation ne produit aucune valeur', () => {
  const project = createProject('p')
  const progress = createProgressModule('p4', 'Progress', 4, {})
  project.modules.push(progress.module)
  project.nodes.push(...progress.nodes)
  assert.deepEqual(readProgressStates(project, new Map()), {})
})
