import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram, transpileSelection } from '../../src/utils/transpilation/index.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'
import { examples } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { booleanType, debugFixture, intType, node, program, root, stringType } from '../logic/fixtures.js'

const compiler = process.env.CC || 'cc'
const voidType = { kind: 'primitive', name: 'void' }
const shortIntType = { kind: 'primitive', name: 'short int' }
const uintType = { kind: 'primitive', name: 'uint' }
const floatType = { kind: 'primitive', name: 'float' }
const doubleType = { kind: 'primitive', name: 'double' }
const intFunctionType = { kind: 'function', parameters: [intType], returnType: intType }

// Compile puis exécute le fichier C généré, avec un délai borné.
function runC(code) {
  const directory = mkdtempSync(join(tmpdir(), 'sapphire-c-'))
  const source = join(directory, 'main.c')
  const executable = join(directory, process.platform === 'win32' ? 'main.exe' : 'main')
  writeFileSync(source, code)
  try {
    execFileSync(compiler, ['-std=c11', '-O0', source, '-lm', '-o', executable], { encoding: 'utf8', timeout: 30000 })
    return execFileSync(executable, [], { encoding: 'utf8', timeout: 30000 })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

// Compare la sortie C à celle du simulateur.
function compareExecution(project) {
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, simulation.errorCode)
  const generated = transpileProgram(project, { target: 'c' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  const output = runC(generated.code).trim()
  assert.deepEqual(output ? output.split(/\r?\n/) : [], simulation.output)
  return generated
}

// Prépare un module et un point d'entrée minimal.
function entryProject() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: [] })
  return source
}

test('C : primitives, chaînes, booléens et Print', () => {
  const source = entryProject()
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['textPrint', 'boolPrint', 'intPrint', 'shortPrint', 'uintPrint', 'floatPrint', 'doublePrint']
  node(source, 'm', 'textPrint', 'PrintStatement', {}, { value: 'text' })
  node(source, 'm', 'text', 'Literal', { type: stringType, value: 'hello' })
  node(source, 'm', 'boolPrint', 'PrintStatement', {}, { value: 'flag' })
  node(source, 'm', 'flag', 'Literal', { type: booleanType, value: true })
  node(source, 'm', 'intPrint', 'PrintStatement', {}, { value: 'answer' })
  node(source, 'm', 'answer', 'Literal', { type: intType, value: 42 })
  node(source, 'm', 'shortPrint', 'PrintStatement', {}, { value: 'shortValue' })
  node(source, 'm', 'shortValue', 'Literal', { type: shortIntType, value: -7 })
  node(source, 'm', 'uintPrint', 'PrintStatement', {}, { value: 'uintValue' })
  node(source, 'm', 'uintValue', 'Literal', { type: uintType, value: 3000000000 })
  node(source, 'm', 'floatPrint', 'PrintStatement', {}, { value: 'floatValue' })
  node(source, 'm', 'floatValue', 'Literal', { type: floatType, value: 0.5 })
  node(source, 'm', 'doublePrint', 'PrintStatement', {}, { value: 'doubleValue' })
  node(source, 'm', 'doubleValue', 'Literal', { type: doubleType, value: 2.5 })
  compareExecution(source)
})

test('C : fonctions, conditions, boucles, globales et portées', () => {
  compareExecution(debugFixture())
})

test('C : boucle for avec déclaration, test et mise à jour', () => {
  const source = entryProject()
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['sumDecl', 'loop', 'print']
  node(source, 'm', 'sumDecl', 'VariableDeclaration', { name: 'sum', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  node(source, 'm', 'loop', 'ForStatement', {}, { initializer: 'index', test: 'limit', update: 'increment', body: 'loopBody' })
  node(source, 'm', 'index', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'limit', 'BinaryExpression', { operator: '<=' }, { left: 'iRef', right: 'five' })
  node(source, 'm', 'iRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'index' } })
  node(source, 'm', 'five', 'Literal', { type: intType, value: 5 })
  node(source, 'm', 'increment', 'AssignmentStatement', {}, { target: 'iTarget', value: 'next' })
  node(source, 'm', 'iTarget', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'index' } })
  node(source, 'm', 'next', 'BinaryExpression', { operator: '+' }, { left: 'iRead', right: 'oneMore' })
  node(source, 'm', 'iRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'index' } })
  node(source, 'm', 'oneMore', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'loopBody', 'Block', {}, { statements: ['add'] })
  node(source, 'm', 'add', 'AssignmentStatement', {}, { target: 'sumTarget', value: 'sumPlus' })
  node(source, 'm', 'sumTarget', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'sumDecl' } })
  node(source, 'm', 'sumPlus', 'BinaryExpression', { operator: '+' }, { left: 'sumRead', right: 'iValue' })
  node(source, 'm', 'sumRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'sumDecl' } })
  node(source, 'm', 'iValue', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'index' } })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'sumReadPrint' })
  node(source, 'm', 'sumReadPrint', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'sumDecl' } })
  compareExecution(source)
})

test('C : pointeurs et écriture à travers un déréférencement', () => {
  const source = entryProject()
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['x', 'pointer', 'write', 'print']
  node(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'pointer', 'VariableDeclaration', { name: 'p', type: { kind: 'pointer', pointee: intType } }, { initializer: 'address' })
  node(source, 'm', 'address', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  node(source, 'm', 'write', 'AssignmentStatement', {}, { target: 'deref', value: 'two' })
  node(source, 'm', 'deref', 'UnaryExpression', { operator: '*' }, { operand: 'pRef' })
  node(source, 'm', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'pointer' } })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'xRead' })
  node(source, 'm', 'xRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  compareExecution(source)
})

test('C : pointeurs de fonction nommés avec l’exemple Higher-order', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'higherOrder').build()))
  compareExecution(workspace.project)
})

test('C : variable de type fonction et retour de pointeur de fonction', () => {
  const source = entryProject()
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['fDecl', 'printOne', 'f2Decl', 'printTwo', 'printThree']
  root(source, 'm', 'double', 'FunctionDeclaration', { name: 'double', type: intType }, { parameters: ['doubleParam'], body: 'doubleBody' })
  node(source, 'm', 'doubleParam', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'doubleBody', 'Block', {}, { statements: ['doubleReturn'] })
  node(source, 'm', 'doubleReturn', 'ReturnStatement', {}, { argument: 'doubleProduct' })
  node(source, 'm', 'doubleProduct', 'BinaryExpression', { operator: '*' }, { left: 'doubleValue', right: 'two' })
  node(source, 'm', 'doubleValue', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })

  root(source, 'm', 'apply', 'FunctionDeclaration', { name: 'apply', type: intType }, { parameters: ['applyParam', 'applyTransform'], body: 'applyBody' })
  node(source, 'm', 'applyParam', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'applyTransform', 'Parameter', { name: 'transform', type: intFunctionType })
  node(source, 'm', 'applyBody', 'Block', {}, { statements: ['applyReturn'] })
  node(source, 'm', 'applyReturn', 'ReturnStatement', {}, { argument: 'applyCall' })
  node(source, 'm', 'applyCall', 'CallExpression', {}, { callee: 'applyTransformRef', arguments: ['applyValueRef'] })
  node(source, 'm', 'applyTransformRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'transform' } })
  node(source, 'm', 'applyValueRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })

  root(source, 'm', 'choose', 'FunctionDeclaration', { name: 'choose', type: intFunctionType }, { parameters: [], body: 'chooseBody' })
  node(source, 'm', 'chooseBody', 'Block', {}, { statements: ['chooseReturn'] })
  node(source, 'm', 'chooseReturn', 'ReturnStatement', {}, { argument: 'chooseDoubleRef' })
  node(source, 'm', 'chooseDoubleRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'double' } })

  node(source, 'm', 'fDecl', 'VariableDeclaration', { name: 'f', type: intFunctionType }, { initializer: 'doubleRef' })
  node(source, 'm', 'doubleRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'double' } })
  node(source, 'm', 'printOne', 'PrintStatement', {}, { value: 'applyCallOne' })
  node(source, 'm', 'applyCallOne', 'CallExpression', {}, { callee: 'applyRefOne', arguments: ['twentyOne', 'fRef'] })
  node(source, 'm', 'applyRefOne', 'Reference', {}, {}, { target: { kind: 'name', name: 'apply' } })
  node(source, 'm', 'twentyOne', 'Literal', { type: intType, value: 21 })
  node(source, 'm', 'fRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'f' } })
  node(source, 'm', 'f2Decl', 'VariableDeclaration', { name: 'f2', type: intFunctionType }, { initializer: 'chooseCall' })
  node(source, 'm', 'chooseCall', 'CallExpression', {}, { callee: 'chooseRef', arguments: [] })
  node(source, 'm', 'chooseRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'choose' } })
  node(source, 'm', 'printTwo', 'PrintStatement', {}, { value: 'applyCallTwo' })
  node(source, 'm', 'applyCallTwo', 'CallExpression', {}, { callee: 'applyRefTwo', arguments: ['twentyOneTwo', 'f2Ref'] })
  node(source, 'm', 'applyRefTwo', 'Reference', {}, {}, { target: { kind: 'name', name: 'apply' } })
  node(source, 'm', 'twentyOneTwo', 'Literal', { type: intType, value: 21 })
  node(source, 'm', 'f2Ref', 'Reference', {}, {}, { target: { kind: 'name', name: 'f2' } })
  node(source, 'm', 'printThree', 'PrintStatement', {}, { value: 'chooseImmediate' })
  node(source, 'm', 'chooseImmediate', 'CallExpression', {}, { callee: 'chooseImmediateCall', arguments: ['twentyOneThree'] })
  node(source, 'm', 'chooseImmediateCall', 'CallExpression', {}, { callee: 'chooseImmediateRef', arguments: [] })
  node(source, 'm', 'chooseImmediateRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'choose' } })
  node(source, 'm', 'twentyOneThree', 'Literal', { type: intType, value: 21 })
  compareExecution(source)
})

test('C : débordement entier contrôlé à l’exécution', () => {
  const source = entryProject()
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['a', 'b', 'sumDecl', 'print']
  node(source, 'm', 'a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'max' })
  node(source, 'm', 'max', 'Literal', { type: intType, value: 2147483647 })
  node(source, 'm', 'b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'sumDecl', 'VariableDeclaration', { name: 'sum', type: intType }, { initializer: 'sumExpression' })
  node(source, 'm', 'sumExpression', 'BinaryExpression', { operator: '+' }, { left: 'aRef', right: 'bRef' })
  node(source, 'm', 'aRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'a' } })
  node(source, 'm', 'bRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'b' } })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'sumRead' })
  node(source, 'm', 'sumRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'sumDecl' } })
  const generated = transpileProgram(source, { target: 'c' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.throws(() => runC(generated.code), (error) => error.stderr.includes('NUMERIC_OVERFLOW'))
})

test('C : refus explicites des constructions hors périmètre', () => {
  const classProject = workspaceTemplates.find((template) => template.id === 'classInstance').build().project
  const classResult = transpileProgram(classProject, { target: 'c' })
  assert.equal(classResult.ok, false)
  assert.ok(classResult.diagnostics.some((entry) => entry.code === 'TRANSPILE_C_UNSUPPORTED' && /classes/.test(entry.message)))

  const arrayProject = entryProject()
  arrayProject.nodes.find((entry) => entry.id === 'body').children.statements.push('values')
  node(arrayProject, 'm', 'values', 'VariableDeclaration', { name: 'values', type: { kind: 'array', elementType: intType } }, { initializer: 'literal' })
  node(arrayProject, 'm', 'literal', 'ArrayLiteral', { elementType: intType }, { elements: ['one'] })
  node(arrayProject, 'm', 'one', 'Literal', { type: intType, value: 1 })
  const arrayResult = transpileProgram(arrayProject, { target: 'c' })
  assert.equal(arrayResult.ok, false)
  assert.ok(arrayResult.diagnostics.some((entry) => /tableaux/.test(entry.message)))

  const uninitialized = entryProject()
  uninitialized.nodes.find((entry) => entry.id === 'body').children.statements.push('x')
  node(uninitialized, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType })
  const uninitializedResult = transpileProgram(uninitialized, { target: 'c' })
  assert.equal(uninitializedResult.ok, false)
  assert.ok(uninitializedResult.diagnostics.some((entry) => /initialiseur/.test(entry.message)))

  const character = entryProject()
  character.nodes.find((entry) => entry.id === 'body').children.statements.push('letter')
  node(character, 'm', 'letter', 'VariableDeclaration', { name: 'letter', type: { kind: 'primitive', name: 'char' } }, { initializer: 'a' })
  node(character, 'm', 'a', 'Literal', { type: { kind: 'primitive', name: 'char' }, value: 'a' })
  const characterResult = transpileProgram(character, { target: 'c' })
  assert.equal(characterResult.ok, false)
  assert.ok(characterResult.diagnostics.some((entry) => /char/.test(entry.message)))

  const mathProject = entryProject()
  mathProject.nodes.find((entry) => entry.id === 'body').children.statements.push('call')
  node(mathProject, 'm', 'call', 'ExpressionStatement', {}, { expression: 'absCall' })
  node(mathProject, 'm', 'absCall', 'MathCall', { name: 'abs' }, { arguments: ['one'] })
  node(mathProject, 'm', 'one', 'Literal', { type: intType, value: 1 })
  const mathResult = transpileProgram(mathProject, { target: 'c' })
  assert.equal(mathResult.ok, false)
  assert.ok(mathResult.diagnostics.some((entry) => /opérations natives/.test(entry.message)))

  const castProject = entryProject()
  castProject.nodes.find((entry) => entry.id === 'body').children.statements.push('castStatement')
  node(castProject, 'm', 'castStatement', 'ExpressionStatement', {}, { expression: 'cast' })
  node(castProject, 'm', 'cast', 'CastExpression', { type: doubleType }, { argument: 'one' })
  node(castProject, 'm', 'one', 'Literal', { type: intType, value: 1 })
  const castResult = transpileProgram(castProject, { target: 'c' })
  assert.equal(castResult.ok, false)
  assert.ok(castResult.diagnostics.some((entry) => /conversions explicites/.test(entry.message)))
})

test('C : sélection d’un extrait et refus d’une classe', () => {
  const fixture = debugFixture()
  const selected = transpileSelection(fixture, { kind: 'node', id: 'two' }, { target: 'c' })
  assert.equal(selected.ok, true)
  assert.match(selected.code, /int32_t/)
  const classProject = workspaceTemplates.find((template) => template.id === 'classInstance').build().project
  const classModule = classProject.modules.find((module) => module.kind === 'class')
  const classSelection = transpileSelection(classProject, { kind: 'module', id: classModule.id }, { target: 'c' })
  assert.equal(classSelection.ok, false)
  assert.equal(classSelection.diagnostics[0].code, 'TRANSPILE_C_UNSUPPORTED')
})
