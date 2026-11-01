import test from 'node:test'
import assert from 'node:assert/strict'
import { primitiveType, createNodeBundle, insertSourceNodes, simulateProgram } from '../../src/utils/logic/index.js'
import { initialNodeForm, nodeConfiguration, expressionDraft, expressionOperators, expressionOperandType, expressionSymbols, accessedArrayType, arrayIndexType } from '../../src/components/NodeForm/nodeConfiguration.js'
import { program, root, node, intType, booleanType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Exerce la même insertion atomique que le formulaire, avec des identifiants reproductibles.
function insertDraft(source, draft) {
  let next = 0
  const bundle = createNodeBundle('m', draft, () => `new-${next++}`)
  assert.equal(bundle.ok, true)
  return insertSourceNodes(source, { targetId: { kind: 'module', id: 'm' }, slot: 'rootNodeIds' }, bundle)
}

// Exerce la même insertion que le formulaire d’ajout ouvert sur un bloc ; les identifiants restent uniques entre insertions successives.
let blockSequence = 0
function insertInBlock(source, blockId, draft) {
  const bundle = createNodeBundle('m', draft, () => `stmt-${(blockSequence += 1)}`)
  assert.equal(bundle.ok, true)
  return insertSourceNodes(source, { targetId: { kind: 'node', id: blockId }, slot: 'statements' }, bundle)
}

// Programme avec une procédure qui écrit dans un global, une fonction typée et un point d’entrée vide.
function callableProgram() {
  const source = program('m')
  root(source, 'm', 'total', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  root(source, 'm', 'add', 'FunctionDeclaration', { name: 'add', type: voidType }, { parameters: ['amount'], body: 'addBody' })
  node(source, 'm', 'amount', 'Parameter', { name: 'amount', type: intType })
  node(source, 'm', 'addBody', 'Block', {}, { statements: ['write'] })
  node(source, 'm', 'write', 'AssignmentStatement', {}, { target: 'totalRef', value: 'sum' })
  node(source, 'm', 'totalRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'total' } })
  node(source, 'm', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'totalRef2', right: 'amountRef' })
  node(source, 'm', 'totalRef2', 'Reference', {}, {}, { target: { kind: 'name', name: 'total' } })
  node(source, 'm', 'amountRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'amount' } })
  root(source, 'm', 'four', 'FunctionDeclaration', { name: 'four', type: intType }, { parameters: [], body: 'fourBody' })
  node(source, 'm', 'fourBody', 'Block', {}, { statements: ['back'] })
  node(source, 'm', 'back', 'ReturnStatement', {}, { argument: 'literalFour' })
  node(source, 'm', 'literalFour', 'Literal', { type: intType, value: 4 })
  root(source, 'm', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'startBody' })
  node(source, 'm', 'startBody', 'Block', {}, { statements: [] })
  return source
}

const callables = [
  { id: 'symbol-add', nodeId: 'add', name: 'add', type: { kind: 'function', parameters: [intType], returnType: voidType } },
  { id: 'symbol-four', nodeId: 'four', name: 'four', type: { kind: 'function', parameters: [], returnType: intType } },
  { id: 'symbol-total', nodeId: 'total', name: 'total', type: intType },
]

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

test('choix d’expression : type imposé, ou lecture et tout appel quand aucun type n’est attendu', () => {
  const typed = expressionSymbols(callables, intType)
  assert.deepEqual(typed.references.map((symbol) => symbol.id), ['symbol-total'])
  assert.deepEqual(typed.functions.map((symbol) => symbol.id), ['symbol-four'])
  const free = expressionSymbols(callables, null, true)
  assert.deepEqual(free.references.map((symbol) => symbol.id), ['symbol-total'])
  assert.deepEqual(free.functions.map((symbol) => symbol.id), ['symbol-add', 'symbol-four'])
  assert.deepEqual(expressionSymbols(callables, null), { references: [], functions: [] })
})

test('formulaire Évaluer une valeur : procédure, fonction typée, puis lecture dans un bloc', () => {
  const form = initialNodeForm('ExpressionStatement', null, null, callables)
  const procedure = callableProgram()

  form.expression = { mode: 'call', symbolId: 'symbol-add', arguments: [{ mode: 'literal', value: '7' }] }
  const draft = nodeConfiguration('ExpressionStatement', form, callables)
  assert.equal(draft.children.expression.children.arguments[0].properties.type.name, 'int')
  const called = insertInBlock(procedure, 'startBody', draft)
  assert.equal(called.ok, true)

  form.expression = { mode: 'call', symbolId: 'symbol-four', arguments: [] }
  const valued = insertInBlock(called.project, 'startBody', nodeConfiguration('ExpressionStatement', form, callables))
  assert.equal(valued.ok, true)

  form.expression = { mode: 'reference', symbolId: 'symbol-total' }
  const read = insertInBlock(valued.project, 'startBody', nodeConfiguration('ExpressionStatement', form, callables))
  assert.equal(read.ok, true)
  assert.deepEqual(read.analysis.diagnostics, [])
  assert.equal(read.analysis.canGenerate, true)

  const statements = read.project.nodes.filter((entry) => entry.kind === 'ExpressionStatement')
  assert.equal(statements.length, 3)
  assert.equal(statements.every((entry) => Boolean(entry.children.expression)), true)
  const expressed = statements.map((entry) => read.analysis.semantic.nodeTypes.find((type) => type.nodeId === entry.children.expression)?.type)
  assert.deepEqual(expressed[0], voidType)
  assert.deepEqual(expressed[1], intType)
  assert.deepEqual(expressed[2], intType)

  const printForm = initialNodeForm('PrintStatement', null, null, callables)
  printForm.expression = { mode: 'reference', symbolId: 'symbol-total' }
  const shown = insertInBlock(read.project, 'startBody', nodeConfiguration('PrintStatement', printForm, callables))
  assert.equal(shown.ok, true)
  assert.deepEqual(shown.analysis.diagnostics, [])
  const simulation = simulateProgram(shown.project)
  assert.deepEqual(simulation.output, ['7'])
  assert.equal(simulation.trace.filter((id) => id === 'write').length, 1)
})

test('accès à un élément de tableau dans une variable : création via formulaire', () => {
  const intList = { kind: 'array', elementType: intType }
  const literal = (source, id, type, value) => node(source, 'm', id, 'Literal', { type, value })
  const source = program('m')
  root(source, 'm', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two'] })
  literal(source, 'one', intType, 10)
  literal(source, 'two', intType, 20)
  const symbols = [
    { id: 'symbol-arr', nodeId: 'arr', name: 'arr', type: intList },
  ]
  const form = initialNodeForm('VariableDeclaration', null, intType, symbols)
  form.name = 'x'
  form.typeName = 'int'
  form.initializer = {
    mode: 'arrayAccess',
    accessArray: { mode: 'reference', symbolId: 'symbol-arr' },
    indexTypeName: 'int',
    accessIndex: { mode: 'literal', value: '1' },
  }
  const result = insertDraft(source, nodeConfiguration('VariableDeclaration', form, symbols))
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  // Vérifie que le nœud ArrayAccess a été créé et typé int
  const analysis = result.analysis
  const variableNode = analysis.semantic.nodeTypes.find(entry => entry.nodeId === 'new-0')
  assert(variableNode, 'node created')
  const initializerId = result.project.nodes.find(n => n.id === 'new-0')?.children?.initializer
  const accessNode = result.project.nodes.find(n => n.id === initializerId)
  assert.equal(accessNode?.kind, 'ArrayAccess')
  const accessType = analysis.semantic.nodeTypes.find(entry => entry.nodeId === initializerId)
  assert.deepEqual(accessType?.type, intType)
})

test('formulaire : création directe d’un accès par index avec index variable explicitement typé', () => {
  const intList = { kind: 'array', elementType: intType }
  const uintType = { kind: 'primitive', name: 'uint' }
  let sequence = 0
  // Exerce l’insertion du formulaire ouvert sur le slot d’initialisation d’une variable.
  function insertInSlot(project, targetId, draft) {
    const bundle = createNodeBundle('m', draft, () => `slot-${(sequence += 1)}`)
    assert.equal(bundle.ok, true)
    return insertSourceNodes(project, { targetId: { kind: 'node', id: targetId }, slot: 'initializer' }, bundle)
  }
  const source = program('m')
  root(source, 'm', 'arr', 'VariableDeclaration', { name: 'arr', type: intList }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['zero', 'one'] })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 5 })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 6 })
  root(source, 'm', 'cursor', 'VariableDeclaration', { name: 'cursor', type: uintType }, { initializer: 'cursorValue' })
  node(source, 'm', 'cursorValue', 'Literal', { type: uintType, value: 1 })
  root(source, 'm', 'value', 'VariableDeclaration', { name: 'value', type: intType }, {})
  root(source, 'm', 'spare', 'VariableDeclaration', { name: 'spare', type: intType }, {})
  root(source, 'm', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'startBody' })
  node(source, 'm', 'startBody', 'Block', {}, { statements: ['print'] })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'valueRef' })
  node(source, 'm', 'valueRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'value' } })
  const symbols = [
    { id: 'symbol-arr', nodeId: 'arr', name: 'arr', type: intList },
    { id: 'symbol-cursor', nodeId: 'cursor', name: 'cursor', type: uintType },
    { id: 'symbol-value', nodeId: 'value', name: 'value', type: intType },
  ]

  const form = initialNodeForm('ArrayAccess', null, intType, symbols)
  assert.equal(form.elementTypeName, 'int')
  // Le tableau visé n'accepte que les lectures d'un tableau du type attendu, et l'index que les entiers choisis.
  assert.deepEqual(expressionSymbols(symbols, accessedArrayType(intType)).references.map((symbol) => symbol.id), ['symbol-arr'])
  assert.deepEqual(expressionSymbols(symbols, arrayIndexType('uint')).references.map((symbol) => symbol.id), ['symbol-cursor'])
  assert.deepEqual(arrayIndexType('float'), intType)
  assert.deepEqual(arrayIndexType(''), intType)

  form.accessArray = { mode: 'reference', symbolId: 'symbol-arr' }
  form.indexTypeName = 'uint'
  form.accessIndex = { mode: 'reference', symbolId: 'symbol-cursor' }
  const created = insertInSlot(source, 'value', nodeConfiguration('ArrayAccess', form, symbols))
  assert.equal(created.ok, true, JSON.stringify(created.diagnostics))
  assert.deepEqual(created.analysis.diagnostics, [])
  const access = created.project.nodes.find((entry) => entry.kind === 'ArrayAccess')
  const kindOf = (id) => created.project.nodes.find((entry) => entry.id === id)?.kind
  assert.equal(kindOf(access.children.array), 'Reference')
  assert.equal(kindOf(access.children.index), 'Reference')
  assert.deepEqual(created.analysis.semantic.nodeTypes.find((entry) => entry.nodeId === access.id)?.type, intType)
  const simulation = simulateProgram(created.project)
  assert.equal(simulation.ok, true, simulation.error)
  assert.deepEqual(simulation.output, ['6'])

  // Sans partie saisie, l'accès reste représentable et inspectable comme tout bloc laissé incomplet.
  const partial = insertInSlot(created.project, 'spare', nodeConfiguration('ArrayAccess', initialNodeForm('ArrayAccess', null, intType, symbols), symbols))
  assert.equal(partial.ok, true, JSON.stringify(partial.diagnostics))
  const partialAccess = partial.project.nodes.find((entry) => entry.kind === 'ArrayAccess' && entry.id !== access.id)
  assert.equal(partial.project.nodes.find((entry) => entry.id === partialAccess.children.array)?.kind, 'Hole')
  assert.equal(partial.project.nodes.find((entry) => entry.id === partialAccess.children.index)?.kind, 'Hole')
  assert.ok(partial.analysis.diagnostics.some((entry) => entry.code === 'NODE_INCOMPLETE'))
})
