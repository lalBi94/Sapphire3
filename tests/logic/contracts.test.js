import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateProgram, satisfiesContract, normalizeContracts, contractKinds, contractKindsForType } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const intArray = { kind: 'array', elementType: intType }

// Construit un programme qui déclare x puis lui réaffecte une valeur, avec un contrat optionnel.
function assignmentProgram(contracts, declared, assigned) {
  const source = program('t')
  root(source, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: ['xDecl', 'assign', 'print'] })
  node(source, 't', 'xDecl', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'initial' })
  node(source, 't', 'initial', 'Literal', { type: intType, value: declared })
  node(source, 't', 'assign', 'AssignmentStatement', {}, { target: 'xTarget', value: 'next' })
  node(source, 't', 'xTarget', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'xDecl' } })
  node(source, 't', 'next', 'Literal', { type: intType, value: assigned })
  node(source, 't', 'print', 'PrintStatement', {}, { value: 'xRef' })
  node(source, 't', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'xDecl' } })
  if (contracts) source.nodes.find((entry) => entry.id === 'xDecl').contracts = contracts
  return source
}

test('contrat positive : violation observée quand la valeur cesse d’être positive', () => {
  const result = simulateProgram(assignmentProgram([{ kind: 'positive' }], 5, 0))
  assert.equal(result.ok, true)
  assert.equal(result.contracts.total, 1)
  assert.ok(result.contracts.observations > 0, 'le contrat est évalué')
  assert.equal(result.contracts.violations.length, 1, 'une seule violation pour une même valeur observée')
  assert.equal(result.contracts.violations[0].name, 'x')
  assert.equal(result.contracts.violations[0].kind, 'positive')
})

test('contrat paramétré : seuil et intervalle vérifiés pendant la simulation', () => {
  const result = simulateProgram(assignmentProgram([{ kind: 'greaterThan', arguments: [2] }], 5, 1))
  assert.equal(result.ok, true)
  assert.equal(result.contracts.total, 1)
  assert.equal(result.contracts.violations.length, 1)
  assert.equal(result.contracts.violations[0].kind, 'greaterThan')
  assert.deepEqual(result.contracts.violations[0].arguments, [2])
})

test('contrat respecté : aucune violation signalée', () => {
  const positive = simulateProgram(assignmentProgram([{ kind: 'positive' }], 5, 7))
  assert.equal(positive.contracts.violations.length, 0)
  const nonNegative = simulateProgram(assignmentProgram([{ kind: 'nonNegative' }], 5, 0))
  assert.equal(nonNegative.contracts.violations.length, 0, 'zéro reste positif ou nul')
})

test('contrat nonEmpty : un tableau vide viole la contrainte', () => {
  const source = program('t')
  root(source, 't', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 't', 'body', 'Block', {}, { statements: ['listDecl', 'print'] })
  node(source, 't', 'listDecl', 'VariableDeclaration', { name: 'list', type: intArray }, { initializer: 'empty' })
  node(source, 't', 'empty', 'ArrayLiteral', { elementType: intType }, { elements: [] })
  node(source, 't', 'print', 'PrintStatement', {}, { value: 'listRef' })
  node(source, 't', 'listRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'listDecl' } })
  source.nodes.find((entry) => entry.id === 'listDecl').contracts = [{ kind: 'nonEmpty' }]
  const result = simulateProgram(source)
  assert.equal(result.ok, true)
  assert.equal(result.contracts.violations.length, 1)
  assert.equal(result.contracts.violations[0].kind, 'nonEmpty')
  assert.equal(result.contracts.violations[0].value, '[]')
})

test('sans contrat, le résultat ne signale rien', () => {
  const result = simulateProgram(assignmentProgram(null, 5, 0))
  assert.equal(result.contracts.total, 0)
  assert.deepEqual(result.contracts.violations, [])
})

test('contrats proposés : le type déclaré filtre les genres applicables', () => {
  const intContracts = contractKindsForType(intType)
  assert.ok(intContracts.includes('even') && intContracts.includes('between'))
  assert.equal(intContracts.includes('contains'), false)
  assert.equal(intContracts.includes('isTrue'), false)
  const doubleContracts = contractKindsForType({ kind: 'primitive', name: 'double' })
  assert.ok(doubleContracts.includes('greaterThan'))
  assert.equal(doubleContracts.includes('even'), false)
  const stringContracts = contractKindsForType({ kind: 'primitive', name: 'string' })
  assert.ok(stringContracts.includes('startsWith') && stringContracts.includes('minLength'))
  assert.equal(stringContracts.includes('positive'), false)
  assert.deepEqual(contractKindsForType({ kind: 'primitive', name: 'boolean' }), ['isTrue', 'isFalse'])
  const arrayContracts = contractKindsForType(intArray)
  assert.ok(arrayContracts.includes('sortedAscending') && arrayContracts.includes('uniqueElements') && arrayContracts.includes('minLength'))
  assert.equal(arrayContracts.includes('even'), false)
  assert.equal(contractKindsForType({ kind: 'array', elementType: { kind: 'primitive', name: 'boolean' } }).includes('sortedAscending'), false)
  assert.deepEqual(contractKindsForType({ kind: 'pointer', pointee: intType }), [])
  assert.deepEqual(contractKindsForType({ kind: 'function', parameters: [intType], returnType: voidType }), [])
  assert.deepEqual(contractKindsForType(null), [])
})

test('helpers de contrat : genres connus, évaluation et normalisation', () => {
  assert.ok(contractKinds.includes('positive'))
  assert.ok(contractKinds.includes('greaterThan'))
  assert.ok(contractKinds.includes('sortedAscending'))
  assert.ok(contractKinds.includes('isTrue'))
  assert.equal(contractKinds.includes('bogus'), false)
  assert.equal(satisfiesContract('positive', 3n), true)
  assert.equal(satisfiesContract('positive', 0n), false)
  assert.equal(satisfiesContract('positive', 'text'), null, 'non applicable')
  assert.equal(satisfiesContract('nonEmpty', [1]), true)
  assert.equal(satisfiesContract('nonEmpty', ''), false)
  assert.equal(satisfiesContract('nonEmpty', 5), null, 'non applicable')
  // Nombres : parité, seuils et intervalle.
  assert.equal(satisfiesContract('even', 4n), true)
  assert.equal(satisfiesContract('odd', 5n), true)
  assert.equal(satisfiesContract('greaterThan', 5n, [3]), true)
  assert.equal(satisfiesContract('lessThan', 5n, [3]), false)
  assert.equal(satisfiesContract('between', 5, [1, 4]), false)
  assert.equal(satisfiesContract('between', 4, [1, 4]), true)
  // Chaînes.
  assert.equal(satisfiesContract('nonBlank', '  '), false)
  assert.equal(satisfiesContract('singleLine', 'a\nb'), false)
  assert.equal(satisfiesContract('startsWith', 'hello', ['he']), true)
  assert.equal(satisfiesContract('endsWith', 'hello', ['lo']), true)
  assert.equal(satisfiesContract('contains', 'hello', ['ell']), true)
  assert.equal(satisfiesContract('minLength', 'abc', [4]), false)
  // Tableaux et booléens.
  assert.equal(satisfiesContract('uniqueElements', [1, 2, 2]), false)
  assert.equal(satisfiesContract('sortedAscending', [1, 2, 3]), true)
  assert.equal(satisfiesContract('sortedAscending', [3, 1]), false)
  assert.equal(satisfiesContract('isTrue', true), true)
  assert.equal(satisfiesContract('isFalse', true), false)
  assert.deepEqual(normalizeContracts([{ kind: 'positive' }, { kind: 'bogus' }, null]), [{ kind: 'positive' }])
  assert.deepEqual(normalizeContracts([{ kind: 'greaterThan', arguments: [3] }, { kind: 'greaterThan', arguments: [] }]), [{ kind: 'greaterThan', arguments: [3] }])
  assert.deepEqual(normalizeContracts([{ kind: 'between', arguments: [5, 2] }]), [])
})
