import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, sameType, acceptsOperand, pointerType, isPointerType, pointerPointee, isValidPointee, simulateProgram, createDebugSession } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { initialNodeForm, typeFromName, expressionDraft } from '../../src/components/NodeForm/nodeConfiguration.js'
import { typeLabel } from '../../src/components/LogicTree/logicLabels.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const intPointer = { kind: 'pointer', pointee: intType }
const uintPointer = { kind: 'pointer', pointee: { kind: 'primitive', name: 'uint' } }

// Programme minimal : un entier `x`, son adresse stockée dans `p`, relue via `*p`.
function pointerProgram() {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressOfX' })
  node(source, 'm', 'addressOfX', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  return source
}

// Erreurs bloquantes d'un programme, sans dépendre de la langue des messages.
function errors(project) {
  return analyzeProgram(project).diagnostics.filter((entry) => entry.severity === 'error')
}

test('pointeurs : le catalogue expose le type pointeur et le compare par cible', () => {
  assert.equal(isPointerType(intPointer), true)
  assert.deepEqual(pointerPointee(intPointer), intType)
  assert.equal(isValidPointee(intType), true)
  assert.equal(isValidPointee(voidType), false)
  assert.equal(isValidPointee(intPointer), false)
  assert.equal(pointerType(voidType), null)
  assert.equal(sameType(intPointer, intPointer), true)
  assert.equal(sameType(intPointer, uintPointer), false)
  assert.equal(acceptsOperand('pointer', intPointer), true)
  assert.equal(acceptsOperand('pointer', intType), false)
  assert.equal(acceptsOperand('addressable', intType), true)
  assert.equal(acceptsOperand('addressable', intPointer), false)
  assert.equal(acceptsOperand('matching', intPointer), true)
})

test('pointeurs : &x produit un pointeur, *p relit la valeur pointée', () => {
  const source = pointerProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(analysis.semantic.symbols.find((symbol) => symbol.name === 'p').type, intPointer)
  const addressType = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'addressOfX')?.type
  assert.deepEqual(addressType, intPointer)

  node(source, 'm', 'y', 'VariableDeclaration', { name: 'y', type: intType }, { initializer: 'derefP' })
  node(source, 'm', 'derefP', 'UnaryExpression', { operator: '*' }, { operand: 'pRef' })
  node(source, 'm', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  source.modules[0].rootNodeIds.push('y')
  const deref = analyzeProgram(source)
  assert.deepEqual(deref.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(deref.semantic.symbols.find((symbol) => symbol.name === 'y').type, intType)
})

test('pointeurs : l’adresse d’un littéral et le déréférencement d’un non-pointeur sont refusés', () => {
  const literal = pointerProgram()
  node(literal, 'm', 'seven', 'Literal', { type: intType, value: 7 })
  literal.nodes.find((entry) => entry.id === 'addressOfX').children.operand = 'seven'
  const literalErrors = errors(literal).map((entry) => entry.code)
  assert.ok(literalErrors.includes('PLACEMENT_ILLEGAL'))

  const wrongDeref = pointerProgram()
  node(wrongDeref, 'm', 'bad', 'VariableDeclaration', { name: 'bad', type: intType }, { initializer: 'derefX' })
  node(wrongDeref, 'm', 'derefX', 'UnaryExpression', { operator: '*' }, { operand: 'xRefBad' })
  node(wrongDeref, 'm', 'xRefBad', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  assert.ok(errors(wrongDeref).map((entry) => entry.code).includes('TYPE_MISMATCH'))
})

test('pointeurs : le type pointeur reste réservé aux variables, constantes et paramètres', () => {
  const source = program('m')
  root(source, 'm', 'give', 'FunctionDeclaration', { name: 'give', type: intPointer }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: [] })
  assert.ok(errors(source).map((entry) => entry.code).includes('TYPE_INVALID'))

  const voidPointee = program('m')
  root(voidPointee, 'm', 'bad', 'VariableDeclaration', { name: 'bad', type: { kind: 'pointer', pointee: voidType } })
  assert.ok(errors(voidPointee).map((entry) => entry.code).includes('TYPE_INVALID'))
})

test('pointeurs : un entier ne s’affecte pas à un pointeur sans conversion', () => {
  const source = pointerProgram()
  source.nodes.find((entry) => entry.id === 'addressOfX').children.operand = 'xRef'
  node(source, 'm', 'eight', 'Literal', { type: intType, value: 8 })
  source.nodes.find((entry) => entry.id === 'p').children.initializer = 'eight'
  assert.ok(errors(source).map((entry) => entry.code).includes('TYPE_MISMATCH'))
})

test('pointeurs : les formulaires relisent et construisent le type et l’opérateur', () => {
  assert.deepEqual(typeFromName('int*'), intPointer)
  assert.equal(typeFromName('void*'), null)
  assert.equal(typeLabel(intPointer, (key) => key), 'int*')
  assert.equal(typeLabel({ kind: 'array', elementType: intPointer }, (key) => key), 'int*[]')
  const form = initialNodeForm('VariableDeclaration', { properties: { name: 'p', type: intPointer } }, null, [])
  assert.equal(form.typeName, 'int*')

  const draft = expressionDraft({ mode: 'unary', operator: '&', operand: { mode: 'reference', symbolId: 'x' } }, intPointer, [{ id: 'x', name: 'x', nodeId: 'x', kind: 'VariableDeclaration', type: intType }])
  assert.equal(draft.kind, 'UnaryExpression')
  assert.equal(draft.properties.operator, '&')
  assert.equal(draft.children.operand.kind, 'Reference')
})

// Construit un programme exécutable : `x`, son adresse dans `p`, et une fonction d'entrée.
function executablePointerProgram() {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressOfX' })
  node(source, 'm', 'addressOfX', 'UnaryExpression', { operator: '&' }, { operand: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  return source
}

test('pointeurs : la simulation lit à travers une adresse et observe les mutations', () => {
  const source = executablePointerProgram()
  node(source, 'm', 'body', 'Block', {}, { statements: ['printFirst', 'assignX', 'printSecond'] })
  node(source, 'm', 'printFirst', 'PrintStatement', {}, { value: 'derefFirst' })
  node(source, 'm', 'derefFirst', 'UnaryExpression', { operator: '*' }, { operand: 'pRefFirst' })
  node(source, 'm', 'pRefFirst', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'm', 'assignX', 'AssignmentStatement', {}, { target: 'xTarget', value: 'five' })
  node(source, 'm', 'xTarget', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  node(source, 'm', 'five', 'Literal', { type: intType, value: 5 })
  node(source, 'm', 'printSecond', 'PrintStatement', {}, { value: 'derefSecond' })
  node(source, 'm', 'derefSecond', 'UnaryExpression', { operator: '*' }, { operand: 'pRefSecond' })
  node(source, 'm', 'pRefSecond', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })

  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true)
  assert.deepEqual(simulation.output, ['1', '5'], 'la même adresse relit la valeur mise à jour')
  const pointerVariable = simulation.variables.find((entry) => entry.name === 'p')
  assert.equal(pointerVariable.type, 'int*')
  assert.equal(pointerVariable.value, '&x')
})

test('pointeurs : l’adresse d’un élément de tableau est exécutable et débogable', () => {
  const source = program('m')
  root(source, 'm', 'data', 'VariableDeclaration', { name: 'data', type: { kind: 'array', elementType: intType } }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'three', 'Literal', { type: intType, value: 3 })
  root(source, 'm', 'p', 'VariableDeclaration', { name: 'p', type: intPointer }, { initializer: 'addressOfElement' })
  node(source, 'm', 'addressOfElement', 'UnaryExpression', { operator: '&' }, { operand: 'element' })
  node(source, 'm', 'element', 'ArrayAccess', {}, { array: 'dataRef', index: 'oneIndex' })
  node(source, 'm', 'dataRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'data' } })
  node(source, 'm', 'oneIndex', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['show'] })
  node(source, 'm', 'show', 'PrintStatement', {}, { value: 'derefP' })
  node(source, 'm', 'derefP', 'UnaryExpression', { operator: '*' }, { operand: 'pRef' })
  node(source, 'm', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })

  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true)
  assert.deepEqual(simulation.output, ['2'])

  const session = createDebugSession(source)
  assert.ok(session.frames.length > 0)
  const pointerValues = session.frames.flatMap((frame) => frame.globals).filter((entry) => entry.name === 'p' && entry.initialized)
  assert.equal(pointerValues.at(-1).value, '&[1]')
})

test('pointeurs : la transpilation les refuse, faute d’équivalent cible', () => {
  const source = executablePointerProgram()
  node(source, 'm', 'body', 'Block', {}, { statements: ['show'] })
  node(source, 'm', 'show', 'PrintStatement', {}, { value: 'derefP' })
  node(source, 'm', 'derefP', 'UnaryExpression', { operator: '*' }, { operand: 'pRef' })
  node(source, 'm', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })

  const web = transpileProgram(source, { target: 'javascript' })
  assert.equal(web.ok, false)
  assert.ok(web.diagnostics.some((entry) => entry.code === 'TRANSPILE_EXPRESSION_UNSUPPORTED'))
  const python = transpileProgram(source, { target: 'python' })
  assert.equal(python.ok, false)
  assert.ok(python.diagnostics.some((entry) => entry.code === 'TRANSPILE_EXPRESSION_UNSUPPORTED'))
})
