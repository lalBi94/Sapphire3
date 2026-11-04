import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Programme d'entrée qui affiche deux valeurs, séparées par une affectation.
function printingProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['first', 'decl', 'second'] })
  node(source, 'm', 'firstValue', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'first', 'PrintStatement', {}, { value: 'firstValue' })
  node(source, 'm', 'decl', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'declValue' })
  node(source, 'm', 'declValue', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'secondValue', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'second', 'PrintStatement', {}, { value: 'secondValue' })
  return source
}

test('sortie progressive : chaque ligne porte le pas où elle apparaît', () => {
  const result = simulateProgram(printingProgram())
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['1', '3'])
  assert.equal(result.outputSteps.length, result.output.length)
  assert.deepEqual(result.outputSteps, [...result.outputSteps].sort((left, right) => left - right))
  assert.ok(result.outputSteps[0] > 0)
  assert.ok(result.outputSteps[1] > result.outputSteps[0])
  assert.ok(result.outputSteps[result.outputSteps.length - 1] <= result.trace.length)
})

test('sortie progressive : une erreur d’exécution conserve les lignes déjà produites et leurs pas', () => {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['spin'] })
  node(source, 'm', 'spin', 'WhileStatement', {}, { test: 'always', body: 'spinBody' })
  node(source, 'm', 'always', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  node(source, 'm', 'spinBody', 'Block', {}, { statements: ['spinPrint'] })
  node(source, 'm', 'spinValue', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'spinPrint', 'PrintStatement', {}, { value: 'spinValue' })
  const result = simulateProgram(source, { maxSteps: 20 })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'SIMULATION_STEP_LIMIT')
  assert.ok(result.output.length > 0)
  assert.equal(result.outputSteps.length, result.output.length)
  assert.ok(result.outputSteps.every((step) => step <= result.trace.length))
})