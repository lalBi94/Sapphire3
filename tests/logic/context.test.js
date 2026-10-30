import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, getAvailableActions, resolveContext, getVisibleSymbols, createNodeBundle, insertSourceNodes, updateSourceNode, primitiveType, serializeSource, deserializeSource, diagnosticCodes as codes } from '../../src/utils/logic/index.js'
import { program, root, node } from './fixtures.js'
import { initialNodeForm, nodeConfiguration } from '../../src/components/NodeForm/nodeConfiguration.js'

// Injecte des identifiants reproductibles sans dépendre de crypto, React ou d'une horloge.
function ids() {
  let next = 0
  return () => `new-${next++}`
}

// Prépare le cache que l'interface conserve entre les interactions purement visuelles.
function indexed(source) {
  const analysis = analyzeProgram(source)
  return createContextIndex(source, analysis)
}

// Exerce exactement la chaîne Factory/Mutation/Analyse utilisée par l'interface.
function insert(source, targetId, slot, draft, idFactory) {
  const index = indexed(source)
  const context = resolveContext(source, targetId, slot, index)
  const bundle = createNodeBundle(context.moduleId, draft, idFactory)
  return insertSourceNodes(source, { targetId, slot }, bundle, { index })
}

test('modules : actions déterministes, racines adaptées et restrictions lexicales', () => {
  const source = program('module', 'other')
  const index = indexed(source)
  const ordinary = getAvailableActions(source, 'module', undefined, { index })
  const other = getAvailableActions(source, 'other', 'rootNodeIds', { index })
  assert.equal(ordinary.slot.name, 'rootNodeIds')
  assert.deepEqual(ordinary.actions, other.actions)
  for (const kind of ['FunctionDeclaration', 'TypeDeclaration', 'VariableDeclaration', 'IfStatement', 'WhileStatement', 'ForStatement']) assert.ok(ordinary.actions.some((action) => action.kind === kind))
  for (const kind of ['Parameter', 'ReturnStatement', 'BreakStatement', 'Literal', 'Hole']) assert.ok(!ordinary.actions.some((action) => action.kind === kind))
  assert.equal(ordinary.index.analysis, index.analysis)
  assert.deepEqual(getAvailableActions(source, 'module', undefined, { index }).actions, ordinary.actions)
})

test('insertions racines successives : ordre, identifiants et sérialisation conservés', () => {
  const id = ids()
  let source = program('m')
  const roots = []
  for (const name of ['first', 'second', 'third']) {
    const result = insert(source, 'm', 'rootNodeIds', { kind: 'VariableDeclaration', properties: { name, type: primitiveType('int') } }, id)
    assert.equal(result.ok, true)
    roots.push(result.nodeId)
    source = result.project
  }
  assert.deepEqual(source.modules[0].rootNodeIds, roots)
  assert.equal(analyzeProgram(source).canGenerate, true)
  const restored = deserializeSource(serializeSource(source).json).source
  assert.deepEqual(restored, source)
  assert.deepEqual(analyzeProgram(restored).ast, analyzeProgram(source).ast)
})

test('slot unique : pas de remplacement implicite, mauvais type refusé atomiquement', () => {
  const source = program('m')
  root(source, 'm', 'variable', 'VariableDeclaration', { name: 'x', type: primitiveType('int') })
  const id = ids()
  const incompatible = insert(source, 'variable', 'initializer', { kind: 'Literal', properties: { type: primitiveType('string'), value: 'bad' } }, id)
  assert.equal(incompatible.ok, false)
  assert.equal(incompatible.project, source)
  const result = insert(source, 'variable', 'initializer', { kind: 'Literal', properties: { type: primitiveType('int'), value: '42' } }, id)
  assert.equal(result.ok, true)
  assert.equal(result.analysis.canGenerate, true)
  const again = insert(result.project, 'variable', 'initializer', { kind: 'Literal', properties: { type: primitiveType('int'), value: '7' } }, id)
  assert.equal(again.code, 'SLOT_OCCUPIED')
  assert.equal(again.project, result.project)
  assert.equal(again.project.nodes.find((entry) => entry.id === 'variable').children.initializer, result.nodeId)
  assert.deepEqual(getAvailableActions(result.project, result.nodeId, undefined, { index: result.index }).actions, [])
})

test('fonction : paramètres séparés du corps, portée et retour incomplet conservés', () => {
  const id = ids()
  const created = insert(program('m'), 'm', 'rootNodeIds', { kind: 'FunctionDeclaration', properties: { name: 'f', type: primitiveType('int') }, children: { parameters: [], body: { kind: 'Block', children: { statements: [] } } } }, id)
  assert.equal(created.ok, true)
  const fn = created.project.nodes.find((entry) => entry.id === created.nodeId)
  const actions = getAvailableActions(created.project, fn.id, undefined, { index: created.index })
  assert.deepEqual(actions.slots.map((slot) => slot.name), ['parameters', 'body'])
  assert.equal(actions.slots.find((slot) => slot.name === 'body').occupied, true)
  assert.deepEqual(getAvailableActions(created.project, fn.id, 'parameters', { index: created.index }).actions.map((action) => action.kind), ['Parameter'])
  const parameter = insert(created.project, fn.id, 'parameters', { kind: 'Parameter', properties: { name: 'p', type: primitiveType('int') } }, id)
  assert.equal(parameter.ok, true)
  const bodyActions = getAvailableActions(parameter.project, fn.children.body, 'statements', { index: parameter.index })
  assert.ok(bodyActions.actions.some((action) => action.kind === 'ReturnStatement'))
  for (const kind of ['FunctionDeclaration', 'TypeDeclaration', 'BreakStatement', 'Parameter']) assert.ok(!bodyActions.actions.some((action) => action.kind === kind))
  assert.ok(getVisibleSymbols(bodyActions).some((symbol) => symbol.name === 'p'))
  const returned = insert(parameter.project, fn.children.body, 'statements', { kind: 'ReturnStatement' }, id)
  assert.equal(returned.ok, true)
  assert.equal(returned.analysis.canGenerate, false)
  const completed = insert(returned.project, returned.nodeId, 'argument', { kind: 'Reference', references: { target: { kind: 'node', nodeId: parameter.nodeId } } }, id)
  assert.equal(completed.ok, true)
  assert.equal(completed.analysis.canGenerate, true)
})

test('while/for : contexte de boucle et slots multiples, ordre conservé dans statements', () => {
  for (const kind of ['WhileStatement', 'ForStatement']) {
    const id = ids()
    const loop = insert(program('m'), 'm', 'rootNodeIds', { kind, children: { body: { kind: 'Block', children: { statements: [] } } } }, id)
    assert.equal(loop.ok, true)
    const record = loop.project.nodes.find((entry) => entry.id === loop.nodeId)
    const body = record.children.body
    const actions = getAvailableActions(loop.project, body, 'statements', { index: loop.index })
    assert.ok(actions.actions.some((action) => action.kind === 'BreakStatement'))
    assert.ok(actions.actions.some((action) => action.kind === 'ContinueStatement'))
    assert.ok(!actions.actions.some((action) => action.kind === 'ReturnStatement'))
    const first = insert(loop.project, body, 'statements', { kind: 'BreakStatement' }, id)
    const second = insert(first.project, body, 'statements', { kind: 'ContinueStatement' }, id)
    assert.equal(second.ok, true)
    assert.deepEqual(second.project.nodes.find((entry) => entry.id === body).children.statements, [first.nodeId, second.nodeId])
  }
})

test('if : test booléen, blocs imposés et slots occupés explicites', () => {
  const source = program('m')
  root(source, 'm', 'if', 'IfStatement', {}, { test: null, consequent: null, alternate: null })
  const id = ids()
  const index = indexed(source)
  const all = getAvailableActions(source, 'if', undefined, { index })
  assert.equal(all.slot, null)
  assert.deepEqual(all.slots.map((slot) => slot.name), ['test', 'consequent', 'alternate'])
  assert.deepEqual(getAvailableActions(source, 'if', 'consequent', { index }).actions.map((action) => action.kind), ['Block'])
  assert.equal(insert(source, 'if', 'test', { kind: 'Literal', properties: { type: primitiveType('int'), value: 1 } }, id).ok, false)
  const result = insert(source, 'if', 'test', { kind: 'Literal', properties: { type: primitiveType('boolean'), value: true } }, id)
  assert.equal(result.ok, true)
  assert.equal(getAvailableActions(result.project, 'if', 'test', { index: result.index }).actions.length, 0)
})

test('binary : opérandes indépendants, contraintes de type et AST reconstruit', () => {
  const source = program('m')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: primitiveType('int') })
  const id = ids()
  const binary = insert(source, 'v', 'initializer', { kind: 'BinaryExpression', properties: { operator: '+' } }, id)
  assert.equal(binary.ok, true)
  const left = insert(binary.project, binary.nodeId, 'left', { kind: 'Literal', properties: { type: primitiveType('int'), value: 1 } }, id)
  const bad = insert(left.project, binary.nodeId, 'right', { kind: 'Literal', properties: { type: primitiveType('uint'), value: 2 } }, id)
  assert.equal(bad.ok, false)
  assert.equal(bad.project, left.project)
  const right = insert(left.project, binary.nodeId, 'right', { kind: 'Literal', properties: { type: primitiveType('int'), value: 2 } }, id)
  assert.equal(right.ok, true)
  assert.equal(right.analysis.canGenerate, true)
  assert.equal(right.analysis.ast.modules[0].body[0].children.initializer.children.right.sourceId, right.nodeId)
})

test('les déclarations imbriquées sont aussi refusées par le validateur, pas seulement par le menu', () => {
  for (const kind of ['FunctionDeclaration', 'TypeDeclaration']) {
    const source = program('m')
    root(source, 'm', 'block', 'Block', {}, { statements: ['nested'] })
    node(source, 'm', 'nested', kind, { name: 'nested', type: primitiveType(kind === 'FunctionDeclaration' ? 'void' : 'int') }, kind === 'FunctionDeclaration' ? { parameters: [], body: 'body' } : {})
    if (kind === 'FunctionDeclaration') node(source, 'm', 'body', 'Block', {}, { statements: [] })
    assert.ok(analyzeProgram(source).diagnostics.some((diagnostic) => diagnostic.code === codes.illegalPlacement && diagnostic.location.nodeId === 'nested'))
  }
})

test('factory et mutations rejettent les contraintes invalides sans supprimer de données', () => {
  const source = program('m')
  const id = ids()
  assert.equal(createNodeBundle('m', { kind: 'Literal', children: { fake: { kind: 'Block' } } }, id).ok, false)
  assert.equal(createNodeBundle('m', { kind: 'Block', children: { statements: { kind: 'BreakStatement' } } }, id).ok, false)
  assert.equal(createNodeBundle('m', { kind: 'WhileStatement', children: { body: { kind: 'Literal' } } }, id).ok, false)
  const bundle = createNodeBundle('m', { kind: 'ReturnStatement' }, id)
  assert.equal(insertSourceNodes(source, { targetId: 'm', slot: 'rootNodeIds' }, bundle).ok, false)
  assert.equal(insertSourceNodes(source, { targetId: 'absent', slot: 'rootNodeIds' }, bundle).project, source)
  assert.doesNotThrow(() => getAvailableActions(null, 'absent'))
  assert.doesNotThrow(() => insertSourceNodes({}, {}, { ok: true, nodes: [null] }))
})

test('contexte lexical : appartenance, références et parenté restent distinctes', () => {
  const source = program('m', 'other')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: primitiveType('int') })
  root(source, 'other', 'foreign', 'VariableDeclaration', { name: 'foreign', type: primitiveType('int') })
  const available = getAvailableActions(source, 'v', 'initializer', { index: indexed(source) })
  assert.deepEqual(getVisibleSymbols(available).map((symbol) => symbol.name), ['v'])
  node(source, 'm', 'detached', 'Block', {}, { statements: [] })
  assert.equal(getAvailableActions(source, 'detached').ok, false)
  source.modules[0].rootNodeIds.push('v')
  assert.equal(getAvailableActions(source, 'v').ok, false)
})

test('mise à jour des propriétés : enfants et références préservés, incohérences visibles', () => {
  const source = program('m')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: primitiveType('int') }, { initializer: 'literal' })
  node(source, 'm', 'literal', 'Literal', { type: primitiveType('int'), value: 1 })
  const updated = updateSourceNode(source, 'v', { properties: { name: 'renamed', type: primitiveType('string') } })
  assert.equal(updated.ok, true)
  assert.equal(updated.analysis.canGenerate, false)
  assert.equal(updated.project.nodes[0].children.initializer, 'literal')
  assert.equal(updated.project.nodes[0].id, 'v')
  assert.equal(updateSourceNode(source, 'v', { children: {} }).ok, false)
})

test('configuration UI : types explicites, paramètres typés, aucune valeur cachée', () => {
  const form = initialNodeForm('ConstantDeclaration', null, null, [])
  form.name = 'constant'; form.typeName = 'int'
  const incomplete = nodeConfiguration('ConstantDeclaration', form, [])
  assert.equal(incomplete.children.initializer, null)
  form.initializer = { mode: 'literal', value: '42', empty: false }
  assert.equal(nodeConfiguration('ConstantDeclaration', form, []).children.initializer.properties.value, '42')
  const fn = initialNodeForm('FunctionDeclaration', null, null, [])
  fn.name = 'f'; fn.typeName = 'void'; fn.parameters = [{ name: 'p', typeName: 'short uint' }]
  const draft = nodeConfiguration('FunctionDeclaration', fn, [])
  assert.equal(draft.children.parameters[0].properties.type.name, 'short uint')
  const unresolved = { kind: 'Reference', properties: {}, references: { target: { kind: 'name', name: 'missing' } } }
  const unchanged = nodeConfiguration('Reference', initialNodeForm('Reference', unresolved, null, []), [], unresolved)
  assert.deepEqual(unchanged.references, unresolved.references)
  const exactNumeric = { kind: 'Literal', properties: { type: primitiveType('float'), value: 1.0000000596046448 }, references: {} }
  const untouched = nodeConfiguration('Literal', initialNodeForm('Literal', exactNumeric, null, []), [], exactNumeric)
  assert.equal(untouched.properties.value, exactNumeric.properties.value)
  assert.equal(typeof untouched.properties.value, 'number')
})

test('appel incomplet : arguments ajoutés un par un sans bloquer l’édition ni dépasser l’arité', () => {
  const source = program('m')
  root(source, 'm', 'f', 'FunctionDeclaration', { name: 'f', type: primitiveType('void') }, { parameters: ['a', 'b'], body: 'body' })
  node(source, 'm', 'a', 'Parameter', { name: 'a', type: primitiveType('int') })
  node(source, 'm', 'b', 'Parameter', { name: 'b', type: primitiveType('boolean') })
  node(source, 'm', 'body', 'Block', {}, { statements: [] })
  root(source, 'm', 'statement', 'ExpressionStatement', {}, { expression: null })
  const id = ids()
  const call = insert(source, 'statement', 'expression', { kind: 'CallExpression', children: { callee: { kind: 'Reference', references: { target: { kind: 'node', nodeId: 'f' } } } } }, id)
  assert.equal(call.ok, true)
  assert.equal(call.analysis.canGenerate, false)
  const first = insert(call.project, call.nodeId, 'arguments', { kind: 'Literal', properties: { type: primitiveType('int'), value: 1 } }, id)
  assert.equal(first.ok, true)
  assert.equal(first.analysis.canGenerate, false)
  const wrong = insert(first.project, call.nodeId, 'arguments', { kind: 'Literal', properties: { type: primitiveType('int'), value: 2 } }, id)
  assert.equal(wrong.ok, false)
  const second = insert(first.project, call.nodeId, 'arguments', { kind: 'Literal', properties: { type: primitiveType('boolean'), value: true } }, id)
  assert.equal(second.ok, true)
  assert.equal(second.analysis.canGenerate, true)
  assert.equal(getAvailableActions(second.project, call.nodeId, 'arguments', { index: second.index }).actions.length, 0)
})

test('contraintes de résultat connues contrôlées avant même la complétion des enfants', () => {
  const source = program('m')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: primitiveType('int') })
  const id = ids()
  for (const draft of [
    { kind: 'Literal', properties: { type: primitiveType('boolean') } },
    { kind: 'BinaryExpression', properties: { operator: 'and' } },
    { kind: 'CastExpression', properties: { type: primitiveType('double') } },
  ]) assert.equal(insert(source, 'v', 'initializer', draft, id).code, 'TYPE_MISMATCH')
  const partial = insert(source, 'v', 'initializer', { kind: 'Literal', properties: { type: primitiveType('int') } }, id)
  assert.equal(partial.ok, true)
  assert.equal(partial.analysis.canGenerate, false)
})

test('identifiant ambigu et proposition périmée : aucune insertion arbitraire', () => {
  const source = program('m')
  root(source, 'm', 'm', 'VariableDeclaration', { name: 'v', type: primitiveType('int') })
  assert.equal(getAvailableActions(source, 'm').ok, false)
  const id = ids()
  const target = { kind: 'node', id: 'm' }
  const index = indexed(source)
  const bundle = createNodeBundle('m', { kind: 'Literal', properties: { type: primitiveType('int'), value: 1 } }, id)
  const first = insertSourceNodes(source, { targetId: target, slot: 'initializer' }, bundle, { index })
  assert.equal(first.ok, true)
  const stale = createNodeBundle('m', { kind: 'Literal', properties: { type: primitiveType('int'), value: 2 } }, id)
  const refused = insertSourceNodes(first.project, { targetId: target, slot: 'initializer' }, stale, { index })
  assert.equal(refused.code, 'SLOT_OCCUPIED')
  assert.equal(refused.project, first.project)
})
