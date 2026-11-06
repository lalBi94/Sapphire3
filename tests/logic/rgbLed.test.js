import test from 'node:test'
import assert from 'node:assert/strict'
import { createRgbLedModule } from '../../src/utils/rgbLedNode.js'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { readRgbLedStates } from '../../src/utils/logic/rgbLedState.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose un projet : une LED RVB cachée et un module qui la pilote.
function rgbLedProject() {
  const rgb = createRgbLedModule('r1', 'RGB LED', 1)
  const project = createProject('p')
  project.modules.push(rgb.module)
  project.nodes.push(...rgb.nodes)
  const app = createModule('app', 'App')
  project.modules.push(app)

  const add = (id, kind, properties = {}, children = {}, references = {}) => {
    project.nodes.push(createNode(id, 'app', kind, { properties, children, references }))
    return id
  }
  const intValue = (id, value) => add(id, 'Literal', { type: intType, value: String(value) })
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

  app.rootNodeIds.push('main')
  add('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  add('body', 'Block', {}, {
    statements: [
      call('setColor', 'setImport', [intValue('redValue', 255), intValue('greenValue', 128), intValue('blueValue', 0)]),
      call('printRed', 'redImport', [], 'PrintStatement'),
      call('printGreen', 'greenImport', [], 'PrintStatement'),
      call('printBlue', 'blueImport', [], 'PrintStatement'),
    ],
  })

  const exported = (name) => rgb.module.exports.find((entry) => entry.name === name).nodeId
  app.imports.push(
    { id: 'setImport', moduleId: 'r1', nodeId: exported('RGBLED_SP3_SET_COLOR_1'), localName: 'setColor' },
    { id: 'redImport', moduleId: 'r1', nodeId: exported('RGBLED_SP3_GET_RED_1'), localName: 'getRed' },
    { id: 'greenImport', moduleId: 'r1', nodeId: exported('RGBLED_SP3_GET_GREEN_1'), localName: 'getGreen' },
    { id: 'blueImport', moduleId: 'r1', nodeId: exported('RGBLED_SP3_GET_BLUE_1'), localName: 'getBlue' },
  )
  return project
}

test('LED RVB : le module caché expose trois canaux et leurs fonctions', () => {
  const rgb = createRgbLedModule('r2', 'RGB LED', 2, { red: 300, green: -5, blue: 12 })
  assert.deepEqual(rgb.module.exports.map((entry) => entry.name), [
    'RGBLED_SP3_SET_COLOR_2',
    'RGBLED_SP3_GET_RED_2',
    'RGBLED_SP3_GET_GREEN_2',
    'RGBLED_SP3_GET_BLUE_2',
  ])
  assert.deepEqual(rgb.module.rgbLed, { index: 2 })
  const declarations = rgb.nodes.filter((node) => node.kind === 'VariableDeclaration')
  assert.deepEqual(declarations.map((node) => node.properties.name), [
    'RGBLED_SP3_GLOBAL_RED_2',
    'RGBLED_SP3_GLOBAL_GREEN_2',
    'RGBLED_SP3_GLOBAL_BLUE_2',
  ])
  assert.deepEqual(declarations.map((node) => rgb.nodes.find((entry) => entry.id === node.children.initializer).properties.value), ['255', '0', '12'])
})

test('LED RVB : SET_COLOR pilote les trois canaux, avec état et images par pas', () => {
  const project = rgbLedProject()
  const analysis = analyzeProgram(project)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['255', '128', '0'])
  assert.deepEqual(result.rgbLeds.r1, { red: 255, green: 128, blue: 0 })
  assert.equal(result.rgbLedFrames.length, result.trace.length)
  assert.deepEqual(result.rgbLedFrames[result.rgbLedFrames.length - 1].r1, { red: 255, green: 128, blue: 0 })
  assert.equal(transpileProgram(project).code, 'TRANSPILE_RGB_LED_UNSUPPORTED')
})

test('LED RVB : un état absent ou incomplet ne produit aucune valeur', () => {
  const project = createProject('p')
  const rgb = createRgbLedModule('r3', 'RGB LED', 3)
  project.modules.push(rgb.module)
  project.nodes.push(...rgb.nodes)
  assert.deepEqual(readRgbLedStates(project, new Map()), {})

  const ids = rgb.nodes.filter((node) => node.kind === 'VariableDeclaration').map((node) => node.id)
  const values = new Map(ids.map((id) => [id, 10]))
  for (const id of ids) {
    for (const invalid of [undefined, null, '10', true, 10.5]) {
      assert.deepEqual(readRgbLedStates(project, new Map([...values, [id, invalid]])), {})
    }
  }
  assert.deepEqual(readRgbLedStates(project, values).r3, { red: 10, green: 10, blue: 10 })
})
