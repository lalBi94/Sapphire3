import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType, stringType, booleanType } from './fixtures.js'

const genericT = { kind: 'generic', name: 'T' }
const genericU = { kind: 'generic', name: 'U' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose deux fonctions à paramètres multiples, une fonction à tableau générique et une fonction contrainte.
function advancedProgram() {
  const source = program('m')
  root(source, 'm', 'pair', 'FunctionDeclaration', { name: 'pair', type: genericU, typeParameters: [{ name: 'T' }, { name: 'U' }] }, { parameters: ['pairFlag', 'pairFirst', 'pairSecond'], body: 'pairBody' })
  node(source, 'm', 'pairFlag', 'Parameter', { name: 'flag', type: booleanType })
  node(source, 'm', 'pairFirst', 'Parameter', { name: 'first', type: genericT })
  node(source, 'm', 'pairSecond', 'Parameter', { name: 'second', type: genericU })
  node(source, 'm', 'pairBody', 'Block', {}, { statements: ['pairReturn'] })
  node(source, 'm', 'pairReturn', 'ReturnStatement', {}, { argument: 'pairSecondRef' })
  node(source, 'm', 'pairSecondRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'pairSecond' } })

  root(source, 'm', 'last', 'FunctionDeclaration', { name: 'last', type: genericT, typeParameters: [{ name: 'T' }] }, { parameters: ['lastItems'], body: 'lastBody' })
  node(source, 'm', 'lastItems', 'Parameter', { name: 'items', type: { kind: 'array', elementType: genericT } })
  node(source, 'm', 'lastBody', 'Block', {}, { statements: ['lastReturn'] })
  node(source, 'm', 'lastReturn', 'ReturnStatement', {}, { argument: 'lastAccess' })
  node(source, 'm', 'lastAccess', 'ArrayAccess', {}, { array: 'lastItemsRef', index: 'zero' })
  node(source, 'm', 'lastItemsRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'lastItems' } })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })

  root(source, 'm', 'intOnly', 'FunctionDeclaration', { name: 'intOnly', type: genericT, typeParameters: [{ name: 'T', constraint: intType }] }, { parameters: ['intOnlyValue'], body: 'intOnlyBody' })
  node(source, 'm', 'intOnlyValue', 'Parameter', { name: 'value', type: genericT })
  node(source, 'm', 'intOnlyBody', 'Block', {}, { statements: ['intOnlyReturn'] })
  node(source, 'm', 'intOnlyReturn', 'ReturnStatement', {}, { argument: 'intOnlyRef' })
  node(source, 'm', 'intOnlyRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'intOnlyValue' } })

  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['printPair', 'printLastInt', 'printLastString', 'printIntOnly'] })
  node(source, 'm', 'printPair', 'PrintStatement', {}, { value: 'pairCall' })
  node(source, 'm', 'pairCall', 'CallExpression', {}, { callee: 'pairRef', arguments: ['yes', 'seven', 'hello'] })
  node(source, 'm', 'pairRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'pair' } })
  node(source, 'm', 'yes', 'Literal', { type: booleanType, value: true })
  node(source, 'm', 'seven', 'Literal', { type: intType, value: 7 })
  node(source, 'm', 'hello', 'Literal', { type: stringType, value: 'hello' })
  node(source, 'm', 'printLastInt', 'PrintStatement', {}, { value: 'lastIntCall' })
  node(source, 'm', 'lastIntCall', 'CallExpression', {}, { callee: 'lastIntRef', arguments: ['intArray'] })
  node(source, 'm', 'lastIntRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'last' } })
  node(source, 'm', 'intArray', 'ArrayLiteral', { elementType: intType }, { elements: ['arraySeven', 'eight'] })
  node(source, 'm', 'arraySeven', 'Literal', { type: intType, value: 7 })
  node(source, 'm', 'eight', 'Literal', { type: intType, value: 8 })
  node(source, 'm', 'printLastString', 'PrintStatement', {}, { value: 'lastStringCall' })
  node(source, 'm', 'lastStringCall', 'CallExpression', {}, { callee: 'lastStringRef', arguments: ['stringArray'] })
  node(source, 'm', 'lastStringRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'last' } })
  node(source, 'm', 'stringArray', 'ArrayLiteral', { elementType: stringType }, { elements: ['hi', 'yo'] })
  node(source, 'm', 'hi', 'Literal', { type: stringType, value: 'hi' })
  node(source, 'm', 'yo', 'Literal', { type: stringType, value: 'yo' })
  node(source, 'm', 'printIntOnly', 'PrintStatement', {}, { value: 'intOnlyCall' })
  node(source, 'm', 'intOnlyCall', 'CallExpression', {}, { callee: 'intOnlyRef2', arguments: ['fortyTwo'] })
  node(source, 'm', 'intOnlyRef2', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'intOnly' } })
  node(source, 'm', 'fortyTwo', 'Literal', { type: intType, value: 42 })
  return source
}

// Retourne le type résolu d'un nœud, ou null.
function typeOf(analysis, nodeId) {
  return analysis.semantic.nodeTypes.find((entry) => entry.nodeId === nodeId)?.type ?? null
}

// Retourne les paramètres de type inférés d'un appel.
function genericsOf(analysis, nodeId) {
  return analysis.semantic.genericCalls.find((entry) => entry.nodeId === nodeId)?.types ?? null
}

test('généricité avancée : T et U sont inférés séparément, y compris dans un tableau générique', () => {
  const source = advancedProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'pairCall'), stringType)
  assert.deepEqual(genericsOf(analysis, 'pairCall'), [{ name: 'T', type: intType }, { name: 'U', type: stringType }])
  assert.deepEqual(typeOf(analysis, 'lastIntCall'), intType)
  assert.deepEqual(genericsOf(analysis, 'lastIntCall'), [{ name: 'T', type: intType }])
  assert.deepEqual(typeOf(analysis, 'lastStringCall'), stringType)
  assert.deepEqual(typeOf(analysis, 'intOnlyCall'), intType)
  assert.deepEqual(simulateProgram(source).output, ['hello', '7', 'hi', '42'])
})

test('généricité avancée : contraintes exactes et inférence ambiguë refusées', () => {
  const mismatch = advancedProgram()
  mismatch.nodes.find((entry) => entry.id === 'fortyTwo').properties = { type: stringType, value: 'nope' }
  const mismatchAnalysis = analyzeProgram(mismatch)
  assert.ok(mismatchAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'intOnlyCall'))

  const arrayConstraint = advancedProgram()
  arrayConstraint.nodes.find((entry) => entry.id === 'intOnly').properties.typeParameters = [{ name: 'T', constraint: { kind: 'array', elementType: intType } }]
  arrayConstraint.nodes.find((entry) => entry.id === 'intOnlyCall').children.arguments = ['stringArray']
  const arrayConstraintAnalysis = analyzeProgram(arrayConstraint)
  assert.ok(arrayConstraintAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'intOnlyCall'))

  const ambiguous = advancedProgram()
  const ambiguousPair = ambiguous.nodes.find((entry) => entry.id === 'pair')
  ambiguousPair.properties.type = genericU
  ambiguousPair.properties.typeParameters = [{ name: 'T' }, { name: 'U' }]
  // U n'apparaît dans aucun paramètre : l'appel ne peut pas l'inférer.
  ambiguousPair.children.parameters = ['pairFlag', 'pairFirst']
  ambiguous.nodes.find((entry) => entry.id === 'pairCall').children.arguments = ['yes', 'seven']
  const ambiguousAnalysis = analyzeProgram(ambiguous)
  assert.ok(ambiguousAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'pairCall'))
})

test('généricité avancée : déclarations de type invalides signalées', () => {
  const duplicate = advancedProgram()
  duplicate.nodes.find((entry) => entry.id === 'pair').properties.typeParameters = [{ name: 'T' }, { name: 'T' }]
  assert.ok(analyzeProgram(duplicate).diagnostics.some((entry) => entry.code === 'STRUCTURE_INVALID' && entry.location.nodeId === 'pair'))

  const lowercase = advancedProgram()
  lowercase.nodes.find((entry) => entry.id === 'pair').properties.typeParameters = [{ name: 't' }]
  assert.ok(analyzeProgram(lowercase).diagnostics.some((entry) => entry.code === 'STRUCTURE_INVALID' && entry.location.nodeId === 'pair'))

  const malformedConstraint = advancedProgram()
  malformedConstraint.nodes.find((entry) => entry.id === 'intOnly').properties.typeParameters = [{ name: 'T', constraint: { kind: 'primitive', name: 'void' } }]
  assert.ok(analyzeProgram(malformedConstraint).diagnostics.some((entry) => entry.code === 'STRUCTURE_INVALID' && entry.location.nodeId === 'intOnly'))

  const misplaced = advancedProgram()
  misplaced.nodes.find((entry) => entry.id === 'pairFirst').properties.typeParameters = [{ name: 'V' }]
  assert.ok(analyzeProgram(misplaced).diagnostics.some((entry) => entry.code === 'STRUCTURE_INVALID' && entry.location.nodeId === 'pairFirst'))
})

test('généricité avancée : simulation et transpilation JavaScript/Python', () => {
  const source = advancedProgram()
  const expected = ['hello', '7', 'hi', '42']
  assert.deepEqual(simulateProgram(source).output, expected)
  const javascript = transpileProgram(source)
  assert.equal(javascript.ok, true, JSON.stringify(javascript.diagnostics))
  assert.deepEqual(execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8', timeout: 3000 }).trim().split(/\r?\n/), expected)
  const python = transpileProgram(source, { target: 'python' })
  assert.equal(python.ok, true, JSON.stringify(python.diagnostics))
  assert.deepEqual(execFileSync('python', ['-c', python.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim().split(/\r?\n/), expected)
})

test('généricité avancée : le workspace conserve plusieurs paramètres et leurs contraintes', () => {
  const source = advancedProgram()
  const cards = source.modules.map((module) => ({ id: module.id, type: 'module', name: module.name, x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }))
  const text = serializeWorkspace(source, cards, { x: 0, y: 0, zoomLevel: 0 })
  const restored = deserializeWorkspace(text).project
  assert.deepEqual(restored.nodes.find((entry) => entry.id === 'pair').properties.typeParameters, [{ name: 'T' }, { name: 'U' }])
  assert.deepEqual(restored.nodes.find((entry) => entry.id === 'intOnly').properties.typeParameters, [{ name: 'T', constraint: intType }])
  assert.deepEqual(analyzeProgram(restored).diagnostics.filter((entry) => entry.severity === 'error'), [])
})
