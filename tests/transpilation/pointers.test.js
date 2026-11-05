import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { examples } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { program, root, node, intType } from '../logic/fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const intPointer = { kind: 'pointer', pointee: intType }

// Exécute le code produit et renvoie ses lignes, quel que soit le séparateur Windows.
function execute(target, code) {
  const output = target === 'python'
    ? execFileSync('python', ['-c', code], { encoding: 'utf8', timeout: 3000 })
    : execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 3000 })
  return output.trim().split(/\r?\n/)
}

// Vérifie la même sortie entre la simulation et les deux backends.
function assertTranspiledOutput(project, expected) {
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, JSON.stringify(analyzeProgram(project).diagnostics.filter((entry) => entry.severity === 'error')))
  assert.deepEqual(simulation.output, expected)
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(project, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), expected, target)
  }
}

// Programme : écriture à travers un pointeur vers une variable et une case de tableau.
function writeThroughProgram() {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressOfX' })
  node(source, 'm', 'addressOfX', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  root(source, 'm', 'arr', 'VariableDeclaration', { name: 'arr', type: { kind: 'array', elementType: intType } }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['e1', 'e2'] })
  node(source, 'm', 'e1', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'e2', 'Literal', { type: intType, value: 2 })
  root(source, 'm', 'pe', 'VariableDeclaration', { name: 'pe', type: intPointer }, { initializer: 'addressOfElement' })
  node(source, 'm', 'addressOfElement', 'UnaryExpression', { operator: '&' }, { operand: 'element' })
  node(source, 'm', 'element', 'ArrayAccess', {}, { array: 'arrRef', index: 'oneIndex' })
  node(source, 'm', 'arrRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'arr' } })
  node(source, 'm', 'oneIndex', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['writeX', 'printX', 'writeElement', 'printElement'] })
  node(source, 'm', 'writeX', 'AssignmentStatement', {}, { target: 'derefTarget', value: 'five' })
  node(source, 'm', 'derefTarget', 'UnaryExpression', { operator: '*' }, { operand: 'pRefWrite' })
  node(source, 'm', 'pRefWrite', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'five', 'Literal', { type: intType, value: 5 })
  node(source, 'm', 'printX', 'PrintStatement', {}, { value: 'xRead' })
  node(source, 'm', 'xRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  node(source, 'm', 'writeElement', 'AssignmentStatement', {}, { target: 'derefElementTarget', value: 'nine' })
  node(source, 'm', 'derefElementTarget', 'UnaryExpression', { operator: '*' }, { operand: 'peRefWrite' })
  node(source, 'm', 'peRefWrite', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'pe' } })
  node(source, 'm', 'nine', 'Literal', { type: intType, value: 9 })
  node(source, 'm', 'printElement', 'PrintStatement', {}, { value: 'elementRead' })
  node(source, 'm', 'elementRead', 'ArrayAccess', {}, { array: 'arrRefRead', index: 'oneIndexRead' })
  node(source, 'm', 'arrRefRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'arr' } })
  node(source, 'm', 'oneIndexRead', 'Literal', { type: intType, value: 1 })
  return source
}

test('transpilation pointeurs : écriture à travers une variable et une case de tableau', () => {
  assertTranspiledOutput(writeThroughProgram(), ['5', '9'])
})

// Programme : adresse d'une locale et d'un paramètre, mutation dans une fonction.
function localAndParameterProgram() {
  const source = program('m')
  root(source, 'm', 'bump', 'FunctionDeclaration', { name: 'bump', type: voidType }, { parameters: ['value'], body: 'bumpBody' })
  node(source, 'm', 'value', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'bumpBody', 'Block', {}, { statements: ['bumpPointer', 'bumpWrite', 'bumpPrint'] })
  node(source, 'm', 'bumpPointer', 'VariableDeclaration', { name: 'pointer', type: intPointer }, { initializer: 'bumpAddress' })
  node(source, 'm', 'bumpAddress', 'UnaryExpression', { operator: '&' }, { operand: 'valueRef' })
  node(source, 'm', 'valueRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'value' } })
  node(source, 'm', 'bumpWrite', 'AssignmentStatement', {}, { target: 'bumpTarget', value: 'bumpNext' })
  node(source, 'm', 'bumpTarget', 'UnaryExpression', { operator: '*' }, { operand: 'bumpPointerRef' })
  node(source, 'm', 'bumpPointerRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'bumpPointer' } })
  node(source, 'm', 'bumpNext', 'BinaryExpression', { operator: '+' }, { left: 'bumpRead', right: 'one' })
  node(source, 'm', 'bumpRead', 'UnaryExpression', { operator: '*' }, { operand: 'bumpReadPointer' })
  node(source, 'm', 'bumpReadPointer', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'bumpPointer' } })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'bumpPrint', 'PrintStatement', {}, { value: 'valuePrint' })
  node(source, 'm', 'valuePrint', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'value' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['local', 'localPointer', 'localWrite', 'localPrint', 'callBump'] })
  node(source, 'm', 'local', 'VariableDeclaration', { name: 'local', type: intType }, { initializer: 'oneLocal' })
  node(source, 'm', 'oneLocal', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'localPointer', 'VariableDeclaration', { name: 'localPointer', type: intPointer }, { initializer: 'localAddress' })
  node(source, 'm', 'localAddress', 'UnaryExpression', { operator: '&' }, { operand: 'localRef' })
  node(source, 'm', 'localRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'local' } })
  node(source, 'm', 'localWrite', 'AssignmentStatement', {}, { target: 'localTarget', value: 'twoLocal' })
  node(source, 'm', 'localTarget', 'UnaryExpression', { operator: '*' }, { operand: 'localPointerRef' })
  node(source, 'm', 'localPointerRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'localPointer' } })
  node(source, 'm', 'twoLocal', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'localPrint', 'PrintStatement', {}, { value: 'localRead' })
  node(source, 'm', 'localRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'local' } })
  node(source, 'm', 'callBump', 'ExpressionStatement', {}, { expression: 'bumpCall' })
  node(source, 'm', 'bumpCall', 'CallExpression', {}, { callee: 'bumpRef', arguments: ['four'] })
  node(source, 'm', 'bumpRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'bump' } })
  node(source, 'm', 'four', 'Literal', { type: intType, value: 4 })
  return source
}

test('transpilation pointeurs : locales et paramètres adressés', () => {
  assertTranspiledOutput(localAndParameterProgram(), ['2', '5'])
})

// Programme : égalité et inégalité de deux adresses.
function pointerEqualityProgram() {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'y', 'VariableDeclaration', { name: 'y', type: intType }, { initializer: 'two' })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressX' })
  node(source, 'm', 'addressX', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  root(source, 'm', 'q', 'VariableDeclaration', { name: 'q', type: intPointer }, { initializer: 'addressY' })
  node(source, 'm', 'addressY', 'UnaryExpression', { operator: '&' }, { operand: 'yRef' })
  node(source, 'm', 'yRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'y' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['same', 'different', 'notDifferent'] })
  node(source, 'm', 'same', 'PrintStatement', {}, { value: 'sameValue' })
  node(source, 'm', 'sameValue', 'BinaryExpression', { operator: '==' }, { left: 'pRead', right: 'pReadAgain' })
  node(source, 'm', 'pRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'pReadAgain', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'different', 'PrintStatement', {}, { value: 'differentValue' })
  node(source, 'm', 'differentValue', 'BinaryExpression', { operator: '==' }, { left: 'pOther', right: 'qRead' })
  node(source, 'm', 'pOther', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'qRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'q' } })
  node(source, 'm', 'notDifferent', 'PrintStatement', {}, { value: 'notDifferentValue' })
  node(source, 'm', 'notDifferentValue', 'BinaryExpression', { operator: '!=' }, { left: 'pOther2', right: 'qRead2' })
  node(source, 'm', 'pOther2', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'qRead2', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'q' } })
  return source
}

test('transpilation pointeurs : égalité d’adresses', () => {
  assertTranspiledOutput(pointerEqualityProgram(), ['true', 'false', 'true'])
})

// Programme : une constante reste protégée à travers un pointeur indirect.
function constantPointerProgram() {
  const source = program('m')
  root(source, 'm', 'c', 'ConstantDeclaration', { name: 'c', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressC' })
  node(source, 'm', 'addressC', 'UnaryExpression', { operator: '&' }, { operand: 'cRef' })
  node(source, 'm', 'cRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'c' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['write'] })
  node(source, 'm', 'write', 'AssignmentStatement', {}, { target: 'target', value: 'two' })
  node(source, 'm', 'target', 'UnaryExpression', { operator: '*' }, { operand: 'pRef' })
  node(source, 'm', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  return source
}

test('transpilation pointeurs : constante protégée à l’exécution', () => {
  const project = constantPointerProgram()
  assert.equal(simulateProgram(project).errorCode, 'SIMULATION_CONST_IMMUTABLE')
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(project, { target })
    assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
    assert.throws(() => execute(target, generated.code), (error) => `${error.stderr}`.includes('SIMULATION_CONST_IMMUTABLE'))
  }
})

test('transpilation pointeurs : l’exemple Pointers passe par les deux backends', () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === 'pointers').build()))
  assertTranspiledOutput(workspace.project, ['3', '8', '8', '3'])
})
