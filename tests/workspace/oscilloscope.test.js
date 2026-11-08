import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, analyzeProgram, simulateProgram, getModuleLinks, createContextIndex } from '../../src/utils/logic/index.js'
import { createOscilloscopeModule, oscilloscopeDefaultSamples } from '../../src/utils/oscilloscopeNode.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { transpileProgram, transpileSelection } from '../../src/utils/transpilation/index.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }
const stringType = { kind: 'primitive', name: 'string' }

// Construit une source logique courte pour les tests de l'oscilloscope.
function builder() {
  const project = createProject('oscilloscope')
  let current = null
  const useModule = (id, name) => { const module = createModule(id, name); project.modules.push(module); current = module; return module }
  const make = (id, kind, properties = {}, children = {}, references = {}) => {
    project.nodes.push(createNode(id, current.id, kind, { properties, children, references }))
    return id
  }
  const root = (id, kind, properties = {}, children = {}, references = {}) => {
    make(id, kind, properties, children, references)
    current.rootNodeIds.push(id)
    return id
  }
  const ref = (id, name) => make(id, 'Reference', {}, {}, { target: { kind: 'name', name } })
  const intValue = (id, value) => make(id, 'Literal', { type: intType, value: String(value) })
  const doubleValue = (id, value) => make(id, 'Literal', { type: doubleType, value: String(value) })
  const stringValue = (id, value) => make(id, 'Literal', { type: stringType, value })
  const binary = (id, operator, left, right) => make(id, 'BinaryExpression', { operator }, { left, right })
  const call = (id, callee, args) => make(id, 'CallExpression', {}, { callee, arguments: args })
  const block = (id, statements) => make(id, 'Block', {}, { statements })
  const assign = (id, target, value) => make(id, 'AssignmentStatement', {}, { target, value })
  const variable = (id, name, type, initializer = null) => make(id, 'VariableDeclaration', { name, type }, { initializer })
  const math = (id, name, args) => make(id, 'MathCall', { name }, { arguments: args })
  const returnValue = (id, argument) => make(id, 'ReturnStatement', {}, { argument })
  return { project, useModule, make, root, ref, intValue, doubleValue, stringValue, binary, call, block, assign, variable, math, returnValue }
}

// Ajoute une fonction (double) -> double au module courant.
function addWave(b, id, name, body) {
  b.root(id, 'FunctionDeclaration', { name, type: doubleType }, { parameters: [`${id}X`], body: `${id}Body` })
  b.make(`${id}X`, 'Parameter', { name: 'x', type: doubleType })
  b.block(`${id}Body`, [`${id}Return`])
  b.returnValue(`${id}Return`, body)
}

// Ajoute un appel importé comme instruction.
function addCallStatement(b, prefix, importId, args) {
  b.make(prefix, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
  b.call(`${prefix}Call`, `${prefix}Callee`, args)
  b.make(`${prefix}Callee`, 'Reference', {}, {}, { target: { kind: 'import', importId } })
}

// Prépare un projet avec un oscilloscope caché et un module appelant.
function oscilloscopeProject(build, importNames) {
  const scope = createOscilloscopeModule('scope', 'Oscilloscope', 1)
  const b = builder()
  b.project.modules.push(scope.module)
  b.project.nodes.push(...scope.nodes)
  b.useModule('app', 'Oscilloscope demo')
  const app = b.project.modules.find((module) => module.id === 'app')
  const exported = (name) => scope.module.exports.find((entry) => entry.name === name).nodeId
  for (const [id, name, localName] of importNames) {
    app.imports.push({ id, moduleId: scope.module.id, nodeId: exported(name), localName })
  }
  build(b)
  return { project: b.project, scope }
}

test('oscilloscope : trois canaux indépendants échantillonnés sur une fenêtre commune', () => {
  const { project, scope } = oscilloscopeProject((b) => {
    addWave(b, 'waveSin', 'waveSin', 'waveSinCall')
    b.math('waveSinCall', 'sin', ['waveSinXRef'])
    b.ref('waveSinXRef', 'x')
    addWave(b, 'waveCos', 'waveCos', 'waveCosCall')
    b.math('waveCosCall', 'cos', ['waveCosXRef'])
    b.ref('waveCosXRef', 'x')
    addWave(b, 'waveDouble', 'waveDouble', 'waveDoubleCall')
    b.math('waveDoubleCall', 'sin', ['waveDoubleAngle'])
    b.binary('waveDoubleAngle', '*', 'waveDoubleTwo', 'waveDoubleXRef')
    b.doubleValue('waveDoubleTwo', 2)
    b.ref('waveDoubleXRef', 'x')
    b.root('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
    b.block('body', ['range', 'addSin', 'addCos', 'addDouble', 'print'])
    addCallStatement(b, 'range', 'rangeImport', ['rangeMin', 'rangeMax'])
    b.doubleValue('rangeMin', -Math.PI)
    b.doubleValue('rangeMax', Math.PI)
    addCallStatement(b, 'addSin', 'addImport', ['sinRef'])
    b.ref('sinRef', 'waveSin')
    addCallStatement(b, 'addCos', 'addImport', ['cosRef'])
    b.ref('cosRef', 'waveCos')
    addCallStatement(b, 'addDouble', 'addImport', ['doubleRef'])
    b.ref('doubleRef', 'waveDouble')
    b.stringValue('message', 'Oscilloscope demo')
    b.make('print', 'PrintStatement', {}, { value: 'message' })
  }, [
    ['addImport', 'OSC_SP3_ADD_CHANNEL_1', 'addChannel'],
    ['rangeImport', 'OSC_SP3_SET_RANGE_1', 'setRange'],
  ])
  assert.equal(scope.module.oscilloscope.samples, oscilloscopeDefaultSamples)
  assert.deepEqual(scope.module.exports.map((entry) => entry.name), [
    'OSC_SP3_ADD_CHANNEL_1',
    'OSC_SP3_SET_CHANNEL_1',
    'OSC_SP3_REMOVE_CHANNEL_1',
    'OSC_SP3_SET_RANGE_1',
    'OSC_SP3_CLEAR_1',
  ])
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['Oscilloscope demo'])
  const state = result.oscilloscopes.scope
  assert.deepEqual(state.channels.map((channel) => channel.id), [1, 2, 3])
  assert.equal(state.samples, oscilloscopeDefaultSamples)
  for (const channel of state.channels) assert.equal(channel.values.length, oscilloscopeDefaultSamples)
  assert.ok(Math.abs(state.channels[0].values[0]) < 1e-9)
  assert.ok(Math.abs(state.channels[0].values.at(-1)) < 1e-9)
  assert.ok(Math.abs(state.channels[1].values[0] + 1) < 1e-9)
  assert.ok(Math.abs(state.channels[1].values.at(-1) + 1) < 1e-9)
  assert.ok(result.oscilloscopeFrames.length > 0)
})

test('oscilloscope : SET_CHANNEL remplace une fonction et REMOVE_CHANNEL libère un emplacement', () => {
  const { project } = oscilloscopeProject((b) => {
    addWave(b, 'waveSin', 'waveSin', 'waveSinCall')
    b.math('waveSinCall', 'sin', ['waveSinXRef'])
    b.ref('waveSinXRef', 'x')
    addWave(b, 'waveCos', 'waveCos', 'waveCosCall')
    b.math('waveCosCall', 'cos', ['waveCosXRef'])
    b.ref('waveCosXRef', 'x')
    b.root('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
    b.block('body', ['first', 'second', 'replace', 'remove', 'print'])
    b.variable('first', 'first', intType, 'firstAdd')
    b.call('firstAdd', 'firstAddCallee', ['sinRef'])
    b.make('firstAddCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'addImport' } })
    b.ref('sinRef', 'waveSin')
    b.variable('second', 'second', intType, 'secondAdd')
    b.call('secondAdd', 'secondAddCallee', ['cosRef'])
    b.make('secondAddCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'addImport' } })
    b.ref('cosRef', 'waveCos')
    addCallStatement(b, 'replace', 'setImport', ['firstRef', 'cosRef2'])
    b.ref('firstRef', 'first')
    b.ref('cosRef2', 'waveCos')
    addCallStatement(b, 'remove', 'removeImport', ['secondRef'])
    b.ref('secondRef', 'second')
    b.stringValue('message', 'done')
    b.make('print', 'PrintStatement', {}, { value: 'message' })
  }, [
    ['addImport', 'OSC_SP3_ADD_CHANNEL_1', 'addChannel'],
    ['setImport', 'OSC_SP3_SET_CHANNEL_1', 'setChannel'],
    ['removeImport', 'OSC_SP3_REMOVE_CHANNEL_1', 'removeChannel'],
  ])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['done'])
  const state = result.oscilloscopes.scope
  assert.deepEqual(state.channels.map((channel) => channel.id), [1])
  assert.ok(Math.abs(state.channels[0].values[0] - Math.cos(-10)) < 1e-9)
  assert.ok(Math.abs(state.channels[0].values.at(-1) - Math.cos(10)) < 1e-9)
})

test('oscilloscope : CLEAR réinitialise les canaux et la fenêtre', () => {
  const { project } = oscilloscopeProject((b) => {
    addWave(b, 'waveSin', 'waveSin', 'waveSinCall')
    b.math('waveSinCall', 'sin', ['waveSinXRef'])
    b.ref('waveSinXRef', 'x')
    b.root('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
    b.block('body', ['addSin', 'clear', 'print'])
    addCallStatement(b, 'addSin', 'addImport', ['sinRef'])
    b.ref('sinRef', 'waveSin')
    addCallStatement(b, 'clear', 'clearImport', [])
    b.stringValue('message', 'cleared')
    b.make('print', 'PrintStatement', {}, { value: 'message' })
  }, [
    ['addImport', 'OSC_SP3_ADD_CHANNEL_1', 'addChannel'],
    ['clearImport', 'OSC_SP3_CLEAR_1', 'clear'],
  ])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  const state = result.oscilloscopes.scope
  assert.deepEqual(state.channels, [])
  assert.equal(state.xMin, -10)
  assert.equal(state.xMax, 10)
  assert.ok(state.revision > 0)
})

test('oscilloscope : carte, lien de dépendance et refus de transpilation', () => {
  assert.equal(moduleTypes.oscilloscope.hasOscilloscope, true)
  assert.equal(moduleTypes.oscilloscope.renamable, true)
  const { project } = oscilloscopeProject((b) => {
    addWave(b, 'waveSin', 'waveSin', 'waveSinCall')
    b.math('waveSinCall', 'sin', ['waveSinXRef'])
    b.ref('waveSinXRef', 'x')
    b.root('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
    b.block('body', ['addSin'])
    addCallStatement(b, 'addSin', 'addImport', ['sinRef'])
    b.ref('sinRef', 'waveSin')
  }, [['addImport', 'OSC_SP3_ADD_CHANNEL_1', 'addChannel']])
  const analysis = analyzeProgram(project)
  const links = getModuleLinks(createContextIndex(project, analysis))
  assert.ok(links.some((link) => link.fromId === 'scope' && link.toId === 'app'))
  for (const target of ['javascript', 'python']) {
    assert.equal(transpileProgram(project, { target }).code, 'TRANSPILE_OSCILLOSCOPE_UNSUPPORTED')
    assert.equal(transpileSelection(project, { kind: 'module', id: 'scope' }, { target }).code, 'TRANSPILE_OSCILLOSCOPE_UNSUPPORTED')
  }
})
