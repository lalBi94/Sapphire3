import test from 'node:test'
import assert from 'node:assert/strict'
import { primitiveType, createNodeBundle, insertSourceNodes } from '../../src/utils/logic/index.js'
import { initialNodeForm, nodeConfiguration, expressionDraft, expressionOperators, expressionOperandType } from '../../src/components/NodeForm/nodeConfiguration.js'
import { program, root, node, intType, booleanType } from './fixtures.js'

// Exerce la même insertion atomique que le formulaire, avec des identifiants reproductibles.
function insertDraft(source, draft) {
  let next = 0
  const bundle = createNodeBundle('m', draft, () => `new-${next++}`)
  assert.equal(bundle.ok, true)
  return insertSourceNodes(source, { targetId: { kind: 'module', id: 'm' }, slot: 'rootNodeIds' }, bundle)
}

// Prépare une comparaison sans ouvrir successivement les slots left et right.
function comparison(left = { mode: 'literal', value: '2' }) {
  return { mode: 'binary', operator: '<', operandTypeName: 'int', left, right: { mode: 'literal', value: '10' } }
}

test('création directe d’une condition complète avec référence et comparaison typées', () => {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType })
  const symbols = [{ id: 'symbol-x', nodeId: 'x', name: 'x', type: intType }]
  const form = initialNodeForm('IfStatement', null, null, symbols)
  form.condition = comparison({ mode: 'reference', symbolId: 'symbol-x' })
  const result = insertDraft(source, nodeConfiguration('IfStatement', form, symbols))
  assert.equal(result.ok, true)
  assert.deepEqual(result.analysis.diagnostics, [])
  const condition = result.analysis.ast.modules[0].body[1].children.test
  assert.equal(condition.kind, 'BinaryExpression')
  assert.equal(condition.properties.operator, '<')
  assert.equal(condition.children.left.kind, 'Reference')
  assert.equal(condition.children.right.properties.type.name, 'int')
  assert.equal(condition.children.right.properties.value, '10')
  assert.equal(source.nodes.length, 1)
})

test('règles d’opérateurs partagées et absence de type numérique implicite', () => {
  assert.ok(expressionOperators('binary', booleanType).some(([operator]) => operator === '<'))
  assert.ok(!expressionOperators('binary', booleanType).some(([operator]) => operator === '+'))
  assert.ok(expressionOperators('binary', intType).some(([operator]) => operator === '+'))
  assert.deepEqual(expressionOperators('unary', booleanType).map(([operator]) => operator), ['not'])
  assert.equal(expressionOperandType({ mode: 'binary', operator: '<', operandTypeName: '' }, booleanType), null)
  assert.equal(expressionOperandType({ mode: 'binary', operator: '<', operandTypeName: 'string' }, booleanType), null)
  assert.deepEqual(expressionOperandType({ mode: 'binary', operator: 'and' }, booleanType), booleanType)
})

test('conditions imbriquées : comparaison et négation créées ensemble', () => {
  const source = program('m')
  const form = initialNodeForm('WhileStatement', null, null, [])
  form.condition = { mode: 'binary', operator: 'and', left: comparison(), right: { mode: 'unary', operator: 'not', operand: { mode: 'literal', value: 'false' } } }
  const result = insertDraft(source, nodeConfiguration('WhileStatement', form, []))
  assert.equal(result.ok, true)
  assert.deepEqual(result.analysis.diagnostics, [])
  assert.equal(result.analysis.ast.modules[0].body[0].children.test.children.right.kind, 'UnaryExpression')
})

test('appel de fonction avec arguments directement dans une condition', () => {
  const source = program('m')
  root(source, 'm', 'predicate', 'FunctionDeclaration', { name: 'predicate', type: booleanType }, { parameters: ['p'], body: 'body' })
  node(source, 'm', 'p', 'Parameter', { name: 'p', type: intType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['return'] })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'value' })
  node(source, 'm', 'value', 'Literal', { type: booleanType, value: true })
  const symbols = [{ id: 'fn', nodeId: 'predicate', name: 'predicate', type: { kind: 'function', parameters: [intType], returnType: booleanType } }]
  const form = initialNodeForm('IfStatement', null, null, symbols)
  form.condition = { mode: 'call', symbolId: 'fn', arguments: [{ mode: 'literal', value: '7' }] }
  const result = insertDraft(source, nodeConfiguration('IfStatement', form, symbols))
  assert.equal(result.ok, true)
  assert.deepEqual(result.analysis.diagnostics, [])
  const call = result.analysis.ast.modules[0].body[1].children.test
  assert.equal(call.kind, 'CallExpression')
  assert.equal(call.children.arguments[0].properties.type.name, 'int')
  assert.equal(expressionDraft({ mode: 'call', symbolId: 'fn' }, booleanType, symbols).children.arguments[0].kind, 'Hole')
})

test('initialiseur composé avec conversion numérique explicite', () => {
  const source = program('m')
  const form = initialNodeForm('VariableDeclaration', null, null, [])
  form.name = 'value'
  form.typeName = 'double'
  form.initializer = { mode: 'cast', operandTypeName: 'int', argument: { mode: 'binary', operator: '+', left: { mode: 'literal', value: '1' }, right: { mode: 'literal', value: '2' } } }
  const result = insertDraft(source, nodeConfiguration('VariableDeclaration', form, []))
  assert.equal(result.ok, true)
  assert.deepEqual(result.analysis.diagnostics, [])
  assert.equal(result.analysis.ast.modules[0].body[0].children.initializer.kind, 'CastExpression')
})

test('types incompatibles refusés atomiquement et opérande vide représentable', () => {
  const source = program('m')
  root(source, 'm', 'flag', 'VariableDeclaration', { name: 'flag', type: booleanType })
  const symbols = [{ id: 'flag', nodeId: 'flag', type: booleanType }]
  const form = initialNodeForm('IfStatement', null, null, symbols)
  form.condition = comparison({ mode: 'reference', symbolId: 'flag' })
  const refused = insertDraft(source, nodeConfiguration('IfStatement', form, symbols))
  assert.equal(refused.ok, false)
  assert.equal(refused.project, source)
  form.condition = comparison()
  delete form.condition.left
  const partial = insertDraft(source, nodeConfiguration('IfStatement', form, symbols))
  assert.equal(partial.ok, true)
  assert.ok(partial.analysis.diagnostics.some((entry) => entry.code === 'NODE_INCOMPLETE'))
  assert.equal(expressionDraft(undefined, primitiveType('boolean'), []), null)
})
