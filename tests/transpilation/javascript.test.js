import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'vite'
import { createModule, createNode, createProject } from '../../src/utils/logic/index.js'
import { transpileProgram, transpileSelection, transpilationLanguages, getTranspilationTargets } from '../../src/utils/transpilation/index.js'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { debugFixture, node, root, intType } from '../logic/fixtures.js'

// Construit un programme minimal avec un point d’entrée et une sortie observable.
function simpleProgram() {
  const project = createProject('transpile')
  project.modules = [createModule('module', 'Module')]
  project.modules[0].rootNodeIds = ['entry']
  project.nodes = [
    createNode('entry', 'module', 'FunctionDeclaration', {
      properties: { name: 'start', type: { kind: 'primitive', name: 'void' }, entryPoint: true },
      children: { parameters: [], body: 'body' },
    }),
    createNode('body', 'module', 'Block', { children: { statements: ['print', 'return'] } }),
    createNode('print', 'module', 'PrintStatement', { children: { value: 'literal' } }),
    createNode('literal', 'module', 'Literal', { properties: { type: { kind: 'primitive', name: 'string' }, value: 'hello' } }),
    createNode('return', 'module', 'ReturnStatement', { children: { argument: null } }),
  ]
  return project
}

test('JavaScript transpilation generates and executes a single file', () => {
  const result = transpileProgram(simpleProgram(), { target: 'javascript' })
  assert.equal(result.ok, true)
  assert.match(result.code, /function main\(\)/)
  assert.match(result.code, /main\(\);/)
  assert.equal(execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8' }).trim(), 'hello')
})

test('JavaScript transpilation requires exactly one entry point', () => {
  const project = simpleProgram()
  project.nodes[0].properties.entryPoint = false
  const result = transpileProgram(project, { target: 'javascript' })
  assert.equal(result.ok, false)
  assert.equal(result.diagnostics.some(({ code }) => code === 'TRANSPILE_ENTRY_POINT_REQUIRED'), true)
})

test('JavaScript transpilation keeps numeric literals serialized as text', () => {
  const project = simpleProgram()
  project.nodes.find((node) => node.id === 'literal').properties = { type: { kind: 'primitive', name: 'int' }, value: '42' }
  const result = transpileProgram(project, { target: 'javascript' })
  assert.equal(result.ok, true)
  assert.equal(execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8' }).trim(), '42')
})

// Compare le fichier autonome au simulateur, avec un délai borné en cas de boucle régressée.
function compareExecution(project) {
  const simulation = simulateProgram(project)
  const generated = transpileProgram(project)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', generated.code], { encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
  assert.equal(simulation.ok, true)
  assert.equal(output, simulation.output.map((line) => `${line}\n`).join(''))
  return generated
}

// Prépare des calculs non constants pour exercer les contrôles runtime du fichier généré.
function binaryProgram(operator, left, right, name = 'int') {
  const project = simpleProgram()
  const type = { kind: 'primitive', name }
  project.nodes = project.nodes.filter((entry) => entry.id !== 'literal')
  project.nodes.find((entry) => entry.id === 'body').children.statements = ['x', 'y', 'print', 'return']
  project.nodes.find((entry) => entry.id === 'print').children.value = 'binary'
  node(project, 'module', 'x', 'VariableDeclaration', { name: 'x', type }, { initializer: 'leftLiteral' })
  node(project, 'module', 'y', 'VariableDeclaration', { name: 'y', type }, { initializer: 'rightLiteral' })
  node(project, 'module', 'leftLiteral', 'Literal', { type, value: left })
  node(project, 'module', 'rightLiteral', 'Literal', { type, value: right })
  node(project, 'module', 'binary', 'BinaryExpression', { operator }, { left: 'left', right: 'right' })
  node(project, 'module', 'left', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  node(project, 'module', 'right', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'y' } })
  return project
}

test('JavaScript : constantes globales, paramètres, blocs et affectations exécutables en mode strict', () => {
  const project = debugFixture()
  root(project, 'm', 'constant', 'ConstantDeclaration', { name: 'constant', type: intType }, { initializer: 'constantValue' })
  node(project, 'm', 'constantValue', 'Literal', { type: intType, value: 42 })
  compareExecution(project)
})

test('JavaScript : les noms de paramètres normalisés ne collisionnent ni entre eux ni avec les fonctions', () => {
  const project = debugFixture()
  project.nodes.find((entry) => entry.id === 'n').properties.name = 'console'
  project.nodes.find((entry) => entry.id === 'twice').children.parameters.push('other')
  node(project, 'm', 'other', 'Parameter', { name: 'consolé', type: intType })
  project.nodes.find((entry) => entry.id === 'call').children.arguments.push('extra')
  node(project, 'm', 'extra', 'Literal', { type: intType, value: 1 })
  compareExecution(project)
  project.nodes.find((entry) => entry.id === 'n').properties.name = 'a-b'
  project.nodes.find((entry) => entry.id === 'other').properties.name = 'a b'
  compareExecution(project)
})

test('JavaScript : entiers avec zéros initiaux, signes et arrondi direct des littéraux float', () => {
  for (const [name, value] of [['int', '00042'], ['int', '+0042'], ['float', '1.0000000596046447753906250000000000001'], ['double', '-0']]) {
    const project = simpleProgram()
    project.nodes.find((entry) => entry.id === 'literal').properties = { type: { kind: 'primitive', name }, value }
    compareExecution(project)
  }
})

test('JavaScript : divisions entières exactes, float arrondi et comparaisons strictes', () => {
  for (const args of [['/', -7, 2], ['/', 7, 2, 'double'], ['+', 16777216, 1, 'float'], ['==', 1, 1], ['%', -7, 2], ['+', 4294967294, 1, 'uint']]) compareExecution(binaryProgram(...args))
})

test('JavaScript : mêmes erreurs numériques runtime que le simulateur', () => {
  for (const args of [['+', 2147483647, 1], ['*', 2147483647, 2147483647], ['/', 1, 0], ['*', '1e-30', '1e-30', 'float']]) {
    const project = binaryProgram(...args)
    const simulation = simulateProgram(project)
    const generated = transpileProgram(project)
    assert.equal(generated.ok, true)
    assert.equal(simulation.ok, false)
    assert.throws(() => execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes(simulation.errorCode))
  }
})

test('JavaScript : conversions numériques et identité textuelle', () => {
  for (const [from, to, value] of [['double', 'int', '-3.75'], ['int', 'float', 16777217], ['string', 'string', 'hello']]) {
    const project = simpleProgram()
    project.nodes.find((entry) => entry.id === 'literal').properties = { type: { kind: 'primitive', name: from }, value }
    project.nodes.find((entry) => entry.id === 'print').children.value = 'cast'
    node(project, 'module', 'cast', 'CastExpression', { type: { kind: 'primitive', name: to } }, { argument: 'literal' })
    compareExecution(project)
  }
})

test('JavaScript : for avec update expression exécuté après continue', () => {
  const project = debugFixture()
  project.nodes.find((entry) => entry.id === 'mainBody').children.statements.unshift('loop')
  node(project, 'm', 'loop', 'ForStatement', {}, { initializer: null, test: 'test', update: 'updateCall', body: 'loopBody' })
  node(project, 'm', 'test', 'BinaryExpression', { operator: '<' }, { left: 'globalRef', right: 'limit' })
  node(project, 'm', 'globalRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'g' } })
  node(project, 'm', 'limit', 'Literal', { type: intType, value: 3 })
  node(project, 'm', 'loopBody', 'Block', {}, { statements: ['continue'] })
  node(project, 'm', 'continue', 'ContinueStatement')
  node(project, 'm', 'updateCall', 'CallExpression', {}, { callee: 'updateRef', arguments: ['updateArg'] })
  node(project, 'm', 'updateRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'twice' } })
  node(project, 'm', 'updateArg', 'Literal', { type: intType, value: 1 })
  compareExecution(project)
})

test('JavaScript : lecture non initialisée refusée', () => {
  const project = binaryProgram('+', 1, 2)
  project.nodes.find((entry) => entry.id === 'x').children.initializer = null
  project.nodes = project.nodes.filter((entry) => entry.id !== 'leftLiteral')
  const generated = transpileProgram(project)
  assert.equal(generated.ok, true)
  assert.throws(() => execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes('SIMULATION_UNINITIALIZED'))
})

test('JavaScript : sources invalides et noms de cibles hérités refusés sans exception', () => {
  for (const source of [null, {}, { modules: null }, { ...simpleProgram(), nodes: [] }]) {
    const result = transpileProgram(source)
    assert.equal(result.ok, false)
    assert.equal(result.code, '')
  }
  for (const target of ['toString', 'constructor', '__proto__']) {
    const result = transpileProgram(simpleProgram(), { target })
    assert.equal(result.ok, false)
    assert.equal(result.diagnostics[0].code, 'TRANSPILE_TARGET_UNSUPPORTED')
  }
})

test('JavaScript : point d’entrée paramétré refusé plutôt qu’appelé sans arguments', () => {
  const project = simpleProgram()
  project.nodes[0].children.parameters.push('parameter')
  node(project, 'module', 'parameter', 'Parameter', { name: 'parameter', type: intType })
  const generated = transpileProgram(project)
  assert.equal(generated.ok, false)
  assert.equal(generated.diagnostics.some(({ code }) => code === 'TRANSPILE_ENTRY_POINT_INPUTS'), true)
})

test('JavaScript : le runtime partagé reste autonome après compilation et minification Vite', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: true, lib: { entry: 'src/utils/transpilation/index.js', formats: ['es'] } },
  })
  const outputBundle = Array.isArray(bundle) ? bundle[0] : bundle
  const backend = await import(`data:text/javascript;base64,${Buffer.from(outputBundle.output[0].code).toString('base64')}`)
  const project = debugFixture()
  const result = backend.transpileProgram(project)
  assert.equal(result.ok, true)
  const output = execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8', timeout: 3000 })
  assert.equal(output, simulateProgram(project).output.map((line) => `${line}\n`).join(''))
})

test('JavaScript : exemple workspace exécutable et exemple algorithmes incomplet refusé', () => {
  const workspace = JSON.parse(readFileSync(new URL('../../public/verify/workspace.sp3', import.meta.url), 'utf8'))
  compareExecution(workspace.project)
  const algorithms = JSON.parse(readFileSync(new URL('../../public/verify/algorithms.sp3', import.meta.url), 'utf8'))
  const generated = transpileProgram(algorithms.project)
  assert.equal(generated.ok, false)
  assert.equal(generated.code, '')
  assert.equal(generated.diagnostics.some(({ code }) => code === 'NODE_INCOMPLETE'), true)
})

test('aperçu : expressions, instructions, fonctions, paramètres et modules utilisent le backend existant', () => {
  const project = debugFixture()
  const full = transpileProgram(project)
  for (const id of ['local', 'callPrint', 'call', 'returnMain', 'twice', 'n']) {
    const preview = transpileSelection(project, { kind: 'node', id })
    assert.equal(preview.ok, true, id)
    assert.ok(preview.code.length > 0, id)
    assert.ok(full.code.includes(preview.code), `${id}: ${preview.code}`)
  }
  assert.equal(transpileSelection(project, { kind: 'node', id: 'g' }).code, 'let Debug_g = (1n);')
  assert.equal(transpileSelection(project, { kind: 'module', id: 'm' }).ok, true)
  assert.equal(transpileSelection(project, { kind: 'node', id: 'missing' }).ok, false)
})

test('aperçu : pas de point d’entrée exigé, sous-arbre incomplet refusé, autres nœuds consultables', () => {
  const project = simpleProgram()
  project.nodes[0].properties.entryPoint = false
  assert.equal(transpileSelection(project, { kind: 'node', id: 'literal' }).code, '"hello"')
  project.nodes.find(({ id }) => id === 'print').children.value = null
  project.nodes = project.nodes.filter(({ id }) => id !== 'literal')
  assert.equal(transpileSelection(project, { kind: 'node', id: 'print' }).ok, false)
  assert.equal(transpileSelection(project, { kind: 'node', id: 'return' }).code, 'return;')
})

test('langages : une seule cible active et quatre langages futurs explicitement indisponibles', () => {
  assert.deepEqual(transpilationLanguages.filter(({ available }) => available).map(({ id }) => id), getTranspilationTargets())
  assert.deepEqual(transpilationLanguages.filter(({ available }) => !available).map(({ name }) => name), ['Python', 'C', 'C++', 'Java'])
  for (const target of ['python', 'c', 'cpp', 'java', 'constructor']) {
    assert.equal(transpileSelection(simpleProgram(), { kind: 'node', id: 'literal' }, { target }).ok, false)
  }
})
