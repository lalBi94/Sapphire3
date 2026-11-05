import test from 'node:test'
import assert from 'node:assert/strict'
import { createLedModule } from '../../src/utils/ledNode.js'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { readLedStates } from '../../src/utils/logic/ledState.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose un projet : une LED cachée et un module qui la pilote.
function ledProject() {
  const led = createLedModule('l1', 'LED', 1, { value: false })
  const project = createProject('p')
  project.modules.push(led.module)
  project.nodes.push(...led.nodes)
  const app = createModule('app', 'App')
  project.modules.push(app)

  const add = (id, kind, properties = {}, children = {}, references = {}) => {
    project.nodes.push(createNode(id, 'app', kind, { properties, children, references }))
    return id
  }
  const call = (prefix, importId, args, statementKind = 'ExpressionStatement') => {
    if (statementKind === 'PrintStatement') {
      add(prefix, 'PrintStatement', {}, { value: `${prefix}Call` })
    } else {
      add(`${prefix}Statement`, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    }
    add(`${prefix}Call`, 'CallExpression', {}, { callee: `${prefix}Callee`, arguments: args })
    add(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
    return statementKind === 'PrintStatement' ? prefix : `${prefix}Statement`
  }
  const printGet = (prefix, importId) => call(prefix, importId, [], 'PrintStatement')

  const statements = []
  statements.push(call('toggleOne', 'toggleImport', []))
  statements.push(printGet('printOne', 'getImport'))
  statements.push(call('setFalse', 'setImport', [add('falseValue', 'Literal', { type: booleanType, value: false })]))
  statements.push(printGet('printTwo', 'getImport'))
  statements.push(call('toggleTwo', 'toggleImport', []))
  statements.push(printGet('printThree', 'getImport'))

  app.rootNodeIds.push('main')
  add('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  add('body', 'Block', {}, { statements })

  const exported = (name) => led.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'toggleImport', moduleId: 'l1', nodeId: exported('LED_SP3_TOGGLE_1'), localName: 'toggle' },
    { id: 'getImport', moduleId: 'l1', nodeId: exported('LED_SP3_GET_VALUE_1'), localName: 'isOn' },
    { id: 'setImport', moduleId: 'l1', nodeId: exported('LED_SP3_SET_VALUE_1'), localName: 'setOn' },
  )
  return project
}

test('LED : le module caché exporte les fonctions de contrôle', () => {
  const led = createLedModule('l2', 'LED', 2, { value: true })
  assert.deepEqual(led.module.exports.map((entry) => entry.name), ['LED_SP3_SET_VALUE_2', 'LED_SP3_GET_VALUE_2', 'LED_SP3_TOGGLE_2'])
  assert.deepEqual(led.module.led, { index: 2 })
  assert.deepEqual(led.nodes.filter((node) => node.kind === 'VariableDeclaration').map((node) => node.properties.name), ['LED_SP3_GLOBAL_VALUE_2'])
  assert.equal(led.nodes.find((node) => node.kind === 'VariableDeclaration').children.initializer, led.nodes.find((node) => node.kind === 'Literal').id)
})

test('LED : pilotée par SET, TOGGLE et GET, avec état et images par pas', () => {
  const project = ledProject()
  const analysis = analyzeProgram(project)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['true', 'false', 'true'])
  assert.deepEqual(result.leds.l1, { value: true })
  assert.equal(result.ledFrames.length, result.trace.length)
  assert.equal(result.ledFrames[result.ledFrames.length - 1].l1.value, true)
  assert.equal(transpileProgram(project).code, 'TRANSPILE_LED_UNSUPPORTED')
})

test('LED : un état absent de la simulation ne produit aucune valeur', () => {
  const project = createProject('p')
  const led = createLedModule('l3', 'LED', 3, {})
  project.modules.push(led.module)
  project.nodes.push(...led.nodes)
  assert.deepEqual(readLedStates(project, new Map()), {})
})