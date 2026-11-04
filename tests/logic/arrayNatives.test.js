import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { program, root, node, intType, stringType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const charType = { kind: 'primitive', name: 'char' }
const intArrayType = { kind: 'array', elementType: intType }
const stringArrayType = { kind: 'array', elementType: stringType }

// Ajoute une fonction principale et son bloc d'instructions.
function mainBody(source, statements) {
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements })
}

// Ajoute une variable typée initialisée par un appel natif.
function nativeVariable(source, id, name, type, native, argumentsIds) {
  node(source, 'm', id, 'VariableDeclaration', { name, type }, { initializer: `${id}Call` })
  node(source, 'm', `${id}Call`, 'MathCall', { name: native }, { arguments: argumentsIds })
}

// Ajoute un littéral typé et retourne son identifiant.
function literal(source, id, type, value) {
  node(source, 'm', id, 'Literal', { type, value })
  return id
}

test('opérations natives de tableaux : tranche, concaténation, recherche, index et inversion', () => {
  const source = program('m')
  mainBody(source, ['values', 'slice', 'concat', 'contains', 'index', 'reverse'])
  node(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'items' })
  node(source, 'm', 'items', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  literal(source, 'one', intType, 1)
  literal(source, 'two', intType, 2)
  literal(source, 'three', intType, 3)
  nativeVariable(source, 'slice', 'slice', intArrayType, 'arraySlice', ['valuesRef', 'zero', 'twoIndex'])
  node(source, 'm', 'valuesRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  literal(source, 'zero', intType, 0)
  literal(source, 'twoIndex', intType, 2)
  nativeVariable(source, 'concat', 'concat', intArrayType, 'arrayConcat', ['valuesRefConcat', 'sliceRef'])
  node(source, 'm', 'valuesRefConcat', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'sliceRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'slice' } })
  nativeVariable(source, 'contains', 'contains', { kind: 'primitive', name: 'boolean' }, 'arrayContains', ['valuesRefContains', 'threeLiteral'])
  node(source, 'm', 'valuesRefContains', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  literal(source, 'threeLiteral', intType, 3)
  nativeVariable(source, 'index', 'index', intType, 'arrayIndexOf', ['valuesRefIndex', 'twoLiteral'])
  node(source, 'm', 'valuesRefIndex', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  literal(source, 'twoLiteral', intType, 2)
  nativeVariable(source, 'reverse', 'reverse', intArrayType, 'arrayReverse', ['valuesRefReverse'])
  node(source, 'm', 'valuesRefReverse', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })

  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'sliceCall')?.type, intArrayType)
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'concatCall')?.type, intArrayType)
  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.errorCode)
  assert.equal(simulation.variables.find((entry) => entry.name === 'slice').value, '[1, 2]')
  assert.equal(simulation.variables.find((entry) => entry.name === 'concat').value, '[1, 2, 3, 1, 2]')
  assert.equal(simulation.variables.find((entry) => entry.name === 'contains').value, 'true')
  assert.equal(simulation.variables.find((entry) => entry.name === 'index').value, '1')
  assert.equal(simulation.variables.find((entry) => entry.name === 'reverse').value, '[3, 2, 1]')
  assert.equal(simulation.variables.find((entry) => entry.name === 'values').value, '[1, 2, 3]')
})

test('opérations natives de texte : découpe, jonction et index unicode', () => {
  const source = program('m')
  mainBody(source, ['text', 'comma', 'parts', 'joined', 'index'])
  node(source, 'm', 'text', 'VariableDeclaration', { name: 'text', type: stringType }, { initializer: 'textValue' })
  literal(source, 'textValue', stringType, 'a,b,')
  node(source, 'm', 'comma', 'VariableDeclaration', { name: 'comma', type: charType }, { initializer: 'commaValue' })
  literal(source, 'commaValue', charType, ',')
  nativeVariable(source, 'parts', 'parts', stringArrayType, 'stringSplit', ['textRef', 'commaRef'])
  node(source, 'm', 'textRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  node(source, 'm', 'commaRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'comma' } })
  nativeVariable(source, 'joined', 'joined', stringType, 'stringJoin', ['partsRef', 'separator'])
  node(source, 'm', 'partsRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'parts' } })
  literal(source, 'separator', stringType, '|')
  nativeVariable(source, 'index', 'index', intType, 'stringIndexOf', ['textRefIndex', 'search'])
  node(source, 'm', 'textRefIndex', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  literal(source, 'search', stringType, 'b')

  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'partsCall')?.type, stringArrayType)
  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.errorCode)
  assert.equal(simulation.variables.find((entry) => entry.name === 'parts').value, '[a, b, ]')
  assert.equal(simulation.variables.find((entry) => entry.name === 'joined').value, 'a|b|')
  assert.equal(simulation.variables.find((entry) => entry.name === 'index').value, '2')
})

test('opérations natives : types incompatibles refusés', () => {
  const source = program('m')
  mainBody(source, ['values', 'badContains', 'badConcat', 'badJoin'])
  node(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'items' })
  node(source, 'm', 'items', 'ArrayLiteral', { elementType: intType }, { elements: ['one'] })
  literal(source, 'one', intType, 1)
  node(source, 'm', 'text', 'VariableDeclaration', { name: 'text', type: stringType }, { initializer: 'textValue' })
  literal(source, 'textValue', stringType, 'a,b')
  nativeVariable(source, 'badContains', 'badContains', { kind: 'primitive', name: 'boolean' }, 'arrayContains', ['valuesRef', 'textRef'])
  node(source, 'm', 'valuesRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'textRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  node(source, 'm', 'badConcat', 'VariableDeclaration', { name: 'badConcat', type: intArrayType }, { initializer: 'badConcatCall' })
  node(source, 'm', 'badConcatCall', 'MathCall', { name: 'arrayConcat' }, { arguments: ['valuesRefConcat', 'parts'] })
  node(source, 'm', 'valuesRefConcat', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'parts', 'VariableDeclaration', { name: 'parts', type: stringArrayType }, { initializer: 'partsCall' })
  node(source, 'm', 'partsCall', 'MathCall', { name: 'stringSplit' }, { arguments: ['textRefSplit', 'comma'] })
  node(source, 'm', 'textRefSplit', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  literal(source, 'comma', charType, ',')
  node(source, 'm', 'badJoin', 'VariableDeclaration', { name: 'badJoin', type: stringType }, { initializer: 'badJoinCall' })
  node(source, 'm', 'badJoinCall', 'MathCall', { name: 'stringJoin' }, { arguments: ['valuesRefJoin', 'separator'] })
  node(source, 'm', 'valuesRefJoin', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  literal(source, 'separator', stringType, '|')

  const analysis = analyzeProgram(source)
  const mismatchFields = analysis.diagnostics.filter((entry) => entry.code === 'TYPE_MISMATCH').map((entry) => entry.location.field)
  assert.ok(mismatchFields.includes('children.arguments[1]'))
  assert.ok(mismatchFields.includes('children.arguments[0]'))
})

test('opérations natives : une tranche hors bornes arrête la simulation', () => {
  const source = program('m')
  mainBody(source, ['values', 'badSlice'])
  node(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'items' })
  node(source, 'm', 'items', 'ArrayLiteral', { elementType: intType }, { elements: ['one'] })
  literal(source, 'one', intType, 1)
  node(source, 'm', 'badSlice', 'VariableDeclaration', { name: 'badSlice', type: intArrayType }, { initializer: 'badSliceCall' })
  node(source, 'm', 'badSliceCall', 'MathCall', { name: 'arraySlice' }, { arguments: ['valuesRefSlice', 'four', 'two'] })
  node(source, 'm', 'valuesRefSlice', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  literal(source, 'four', intType, 4)
  literal(source, 'two', intType, 2)

  assert.deepEqual(analyzeProgram(source).diagnostics.filter((entry) => entry.severity === 'error'), [])
  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, false)
  assert.equal(simulation.errorCode, 'SIMULATION_ARRAY_BOUNDS')
})
