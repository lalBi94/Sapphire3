import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Un point d'entrée vide et une fonction `double(n)` qui déclare une variable locale.
function doubleProgram() {
  const source = program('t')
  root(source, 't', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 't', 'mainBody', 'Block', {}, { statements: ['mainPrint'] })
  node(source, 't', 'mainPrint', 'PrintStatement', {}, { value: 'mainValue' })
  node(source, 't', 'mainValue', 'Literal', { type: intType, value: 1 })
  root(source, 't', 'double', 'FunctionDeclaration', { name: 'double', type: intType }, { parameters: ['n'], body: 'doubleBody' })
  node(source, 't', 'n', 'Parameter', { name: 'n', type: intType })
  node(source, 't', 'doubleBody', 'Block', {}, { statements: ['localDecl', 'returnDouble'] })
  node(source, 't', 'localDecl', 'VariableDeclaration', { name: 'twice', type: intType }, { initializer: 'product' })
  node(source, 't', 'product', 'BinaryExpression', { operator: '*' }, { left: 'nRef', right: 'two' })
  node(source, 't', 'nRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'n' } })
  node(source, 't', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 't', 'returnDouble', 'ReturnStatement', {}, { argument: 'twiceRef' })
  node(source, 't', 'twiceRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'localDecl' } })
  return source
}

test('exécuter une fonction choisie : valeur de retour et variables observées', () => {
  const result = simulateProgram(doubleProgram(), { functionId: 'double', args: [21] })
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.returnValue, '42')
  assert.equal(result.result, 42)
  const byName = Object.fromEntries(result.variables.map((variable) => [variable.name, variable]))
  assert.equal(byName.n.value, '21', 'le paramètre est visible')
  assert.equal(byName.n.type, 'int')
  assert.equal(byName.n.kind, 'local')
  assert.equal(byName.twice.value, '42', 'la variable locale est visible')
})

test('exécuter une fonction choisie : entrées invalides refusées par le moteur', () => {
  const missing = simulateProgram(doubleProgram(), { functionId: 'double', args: [] })
  assert.equal(missing.ok, false)
  assert.equal(missing.errorCode, 'SIMULATION_ARGUMENTS_INVALID')
  const wrongType = simulateProgram(doubleProgram(), { functionId: 'double', args: ['text'] })
  assert.equal(wrongType.ok, false)
  assert.equal(wrongType.errorCode, 'SIMULATION_ARGUMENTS_INVALID')
  const extra = simulateProgram(doubleProgram(), { functionId: 'double', args: [1, 2] })
  assert.equal(extra.ok, false)
  assert.equal(extra.errorCode, 'SIMULATION_ARGUMENTS_INVALID')
})

test('exécuter une fonction choisie : cible inconnue refusée, sans casser le Run du point d’entrée', () => {
  const unknown = simulateProgram(doubleProgram(), { functionId: 'nope', args: [] })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.errorCode, 'SIMULATION_FUNCTION_MISSING')
  const entry = simulateProgram(doubleProgram())
  assert.equal(entry.ok, true, 'le Run par défaut reste le point d’entrée')
  assert.deepEqual(entry.output, ['1'])
  assert.ok(Array.isArray(entry.variables), 'les variables sont exposées aussi pour le point d’entrée')
  const notAFunction = simulateProgram(doubleProgram(), { functionId: 'two', args: [] })
  assert.equal(notAFunction.ok, false)
  assert.equal(notAFunction.errorCode, 'SIMULATION_FUNCTION_MISSING')
})

test('exécuter une fonction choisie : la trace reste celle du seul appel choisi', () => {
  const result = simulateProgram(doubleProgram(), { functionId: 'double', args: [21] })
  assert.ok(result.trace.includes('localDecl'))
  assert.ok(result.trace.includes('returnDouble'))
  assert.ok(!result.trace.includes('mainPrint'), 'le point d’entrée n’est pas exécuté')
})
