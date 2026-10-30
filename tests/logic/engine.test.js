import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, buildLogicalAst, findAstNode, walkAst, serializeSource, deserializeSource, nodeSchema, diagnosticCodes as codes } from '../../src/utils/logic/index.js'
import { program, node, root, intType, booleanType, stringType, twoModules } from './fixtures.js'

// Rend les erreurs de scénario visibles sans dépendre du texte des diagnostics.
function assertValid(result) {
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.canGenerate, true)
}

// Vérifie qu'une erreur pointe bien vers le nœud responsable.
function assertDiagnostic(result, code, nodeId) {
  assert.ok(result.diagnostics.some((entry) => entry.code === code && entry.location.nodeId === nodeId), JSON.stringify(result.diagnostics))
  assert.equal(result.canGenerate, false)
}

test('module vide et identifiants stables', () => {
  const source = program('empty')
  const result = analyzeProgram(source)
  assertValid(result)
  assert.equal(result.ast.sourceId, 'project')
  assert.equal(result.ast.modules[0].sourceId, 'empty')
  assert.deepEqual(result.ast.modules[0].body, [])
  assert.equal(result.semantic.scopes.length, 1)
})

test('zéro ou un Main autorisé ; plusieurs Main signalés sans perte des modules', () => {
  const source = program('a', 'b', 'c')
  assertValid(analyzeProgram(source))
  source.modules[0].kind = 'main'
  assertValid(analyzeProgram(source))
  source.modules[1].kind = 'main'
  source.modules[2].kind = 'main'
  const result = analyzeProgram(source)
  assert.equal(result.canGenerate, false)
  assert.equal(result.ast.modules.length, 3)
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === codes.duplicateMain).map((entry) => entry.location.moduleId), ['b', 'c'])
})

test('plusieurs déclarations et références locales par nom et identifiant', () => {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'value' })
  node(source, 'm', 'value', 'Literal', { value: 3, type: intType })
  root(source, 'm', 'y', 'ConstantDeclaration', { name: 'y', type: intType }, { initializer: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'x' } })
  root(source, 'm', 'z', 'VariableDeclaration', { name: 'z', type: intType }, { initializer: 'idRef' })
  node(source, 'm', 'idRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'x' } })
  const result = analyzeProgram(source)
  assertValid(result)
  assert.equal(result.ast.modules[0].body.length, 3)
  assert.equal(findAstNode(result.ast, 'x').children.initializer.kind, 'Literal')
  assert.deepEqual(result.semantic.symbols.find((symbol) => symbol.nodeId === 'y').type, intType)
  assert.ok(result.semantic.references.every((reference) => reference.symbolId === 'node:x'))
})

test('fonction, paramètres, variable locale, retour et appel typé', () => {
  const source = program('m')
  root(source, 'm', 'f', 'FunctionDeclaration', { name: 'identity', type: intType }, { parameters: ['p'], body: 'body' })
  node(source, 'm', 'p', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['local', 'return'] })
  node(source, 'm', 'local', 'VariableDeclaration', { name: 'copy', type: intType }, { initializer: 'paramRef' })
  node(source, 'm', 'paramRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'localRef' })
  node(source, 'm', 'localRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'copy' } })
  root(source, 'm', 'callResult', 'VariableDeclaration', { name: 'result', type: intType }, { initializer: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'fnRef', arguments: ['arg'] })
  node(source, 'm', 'fnRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'identity' } })
  node(source, 'm', 'arg', 'Literal', { value: 8, type: intType })
  const result = analyzeProgram(source)
  assertValid(result)
  const fn = findAstNode(result.ast, 'f')
  assert.equal(fn.children.parameters[0].sourceId, 'p')
  assert.equal(fn.children.body.children.statements[1].kind, 'ReturnStatement')
  assert.equal(result.semantic.nodeScopes.find((entry) => entry.nodeId === 'local').scopeId, 'function:f')
  assert.deepEqual(result.semantic.symbols.find((symbol) => symbol.nodeId === 'callResult').type, intType)
})

test('conditions, else, while et for imbriqués', () => {
  const source = program('m')
  root(source, 'm', 'while', 'WhileStatement', {}, { test: 'yes', body: 'outer' })
  node(source, 'm', 'yes', 'Literal', { value: true, type: booleanType })
  node(source, 'm', 'outer', 'Block', {}, { statements: ['if'] })
  node(source, 'm', 'if', 'IfStatement', {}, { test: 'condition', consequent: 'then', alternate: 'else' })
  node(source, 'm', 'condition', 'Literal', { value: true, type: booleanType })
  node(source, 'm', 'then', 'Block', {}, { statements: ['for'] })
  node(source, 'm', 'for', 'ForStatement', {}, { initializer: 'index', test: 'forTest', update: 'increment', body: 'inner' })
  node(source, 'm', 'index', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { value: 0, type: intType })
  node(source, 'm', 'forTest', 'Literal', { value: true, type: booleanType })
  node(source, 'm', 'increment', 'AssignmentStatement', {}, { target: 'indexRef', value: 'one' })
  node(source, 'm', 'indexRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'i' } })
  node(source, 'm', 'one', 'Literal', { value: 1, type: intType })
  node(source, 'm', 'inner', 'Block', {}, { statements: ['continue'] })
  node(source, 'm', 'continue', 'ContinueStatement')
  node(source, 'm', 'else', 'Block', {}, { statements: ['break'] })
  node(source, 'm', 'break', 'BreakStatement')
  const result = analyzeProgram(source)
  assertValid(result)
  assert.equal(findAstNode(result.ast, 'while').children.body.children.statements[0].kind, 'IfStatement')
  assert.equal(result.semantic.nodeScopes.find((entry) => entry.nodeId === 'index').scopeId, 'for:for')
})

test('import explicite entre deux modules et conservation du type déclaré', () => {
  const result = analyzeProgram(twoModules())
  assertValid(result)
  const reference = result.semantic.references.find((entry) => entry.nodeId === 'answerReference')
  assert.ok(reference.symbolId.startsWith('import:'))
  assert.deepEqual(result.semantic.symbols.find((entry) => entry.nodeId === 'result').type, intType)
  assert.equal(findAstNode(result.ast, 'answerReference').moduleId, 'app')
  assert.equal(findAstNode(result.ast, 'answer').moduleId, 'math')
})

test('un identifiant stable intermodule ne contourne pas les exports/imports', () => {
  const source = twoModules()
  source.modules[1].imports = []
  source.nodes.find((entry) => entry.id === 'answerReference').references.target = { kind: 'node', nodeId: 'answer' }
  assertDiagnostic(analyzeProgram(source), codes.unresolved, 'answerReference')
  source.modules[1].imports = [{ id: 'private', moduleId: 'math', nodeId: 'answer', localName: 'answer' }]
  source.modules[0].exports = []
  assertDiagnostic(analyzeProgram(source), codes.invalidImport, null)
})

test('références inexistantes et conflit de déclaration localisés', () => {
  const source = program('m')
  root(source, 'm', 'first', 'VariableDeclaration', { name: 'same' })
  root(source, 'm', 'duplicate', 'VariableDeclaration', { name: 'same' }, { initializer: 'missingRef' })
  node(source, 'm', 'missingRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'absent' } })
  const result = analyzeProgram(source)
  assertDiagnostic(result, codes.conflict, 'duplicate')
  assertDiagnostic(result, codes.unresolved, 'missingRef')
  assert.equal(result.diagnostics.find((entry) => entry.code === codes.unresolved).location.moduleId, 'm')
})

test('la portée lexicale ne se réduit pas à l’appartenance au module', () => {
  const source = program('m')
  root(source, 'm', 'block', 'Block', {}, { statements: ['hidden'] })
  node(source, 'm', 'hidden', 'VariableDeclaration', { name: 'hidden' })
  root(source, 'm', 'outside', 'VariableDeclaration', { name: 'outside' }, { initializer: 'hiddenRef' })
  node(source, 'm', 'hiddenRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'hidden' } })
  assertDiagnostic(analyzeProgram(source), codes.unresolved, 'hiddenRef')
})

test('programme incomplet représentable, trous inspectables et données conservées', () => {
  const source = program('m')
  root(source, 'm', 'incomplete', 'IfStatement', {}, { test: null, consequent: null })
  const before = JSON.stringify(source)
  const result = analyzeProgram(source)
  assertDiagnostic(result, codes.incomplete, 'incomplete')
  assert.equal(findAstNode(result.ast, 'incomplete').children.test.kind, 'Hole')
  assert.equal(result.source, source)
  assert.equal(JSON.stringify(source), before)
})

test('erreurs simples de type sur déclaration, test, opérateur et retour', () => {
  const source = program('m')
  root(source, 'm', 'typed', 'VariableDeclaration', { name: 'typed', type: intType }, { initializer: 'text' })
  node(source, 'm', 'text', 'Literal', { value: 'oops', type: stringType })
  root(source, 'm', 'if', 'IfStatement', {}, { test: 'notBool', consequent: 'block' })
  node(source, 'm', 'notBool', 'Literal', { value: 3, type: intType })
  node(source, 'm', 'block', 'Block', {}, { statements: [] })
  root(source, 'm', 'opVar', 'VariableDeclaration', { name: 'op', type: intType }, { initializer: 'sum' })
  node(source, 'm', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'left', right: 'right' })
  node(source, 'm', 'left', 'Literal', { value: true, type: booleanType })
  node(source, 'm', 'right', 'Literal', { value: 2, type: intType })
  root(source, 'm', 'f', 'FunctionDeclaration', { name: 'f', type: booleanType }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['return'] })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'wrongReturn' })
  node(source, 'm', 'wrongReturn', 'Literal', { value: 7, type: intType })
  const result = analyzeProgram(source)
  for (const id of ['typed', 'if', 'sum', 'return']) assertDiagnostic(result, codes.typeMismatch, id)
})

test('déclaration de type et alias local statiquement résolu', () => {
  const source = program('m')
  root(source, 'm', 'alias', 'TypeDeclaration', { name: 'Count', type: intType })
  root(source, 'm', 'typed', 'VariableDeclaration', { name: 'typed', type: { kind: 'named', target: { kind: 'name', name: 'Count' } } }, { initializer: 'literal' })
  node(source, 'm', 'literal', 'Literal', { value: 2, type: intType })
  const result = analyzeProgram(source)
  assertValid(result)
  assert.deepEqual(result.semantic.symbols.find((entry) => entry.nodeId === 'typed').type, intType)
})

test('instructions de contrôle illégales et affectation d’une constante', () => {
  const source = program('m')
  root(source, 'm', 'return', 'ReturnStatement')
  root(source, 'm', 'break', 'BreakStatement')
  root(source, 'm', 'constant', 'ConstantDeclaration', { name: 'constant' }, { initializer: 'value' })
  node(source, 'm', 'value', 'Literal', { value: 1 })
  root(source, 'm', 'assign', 'AssignmentStatement', {}, { target: 'target', value: 'newValue' })
  node(source, 'm', 'target', 'Reference', {}, {}, { target: { kind: 'name', name: 'constant' } })
  node(source, 'm', 'newValue', 'Literal', { value: 2 })
  const result = analyzeProgram(source)
  for (const id of ['return', 'break', 'assign']) assertDiagnostic(result, codes.illegalPlacement, id)
})

test('référence syntaxique manquante, parent multiple, cycle et mauvais propriétaire', () => {
  const source = program('a', 'b')
  root(source, 'a', 'missing', 'VariableDeclaration', { name: 'missing' }, { initializer: 'absent' })
  root(source, 'a', 'one', 'VariableDeclaration', { name: 'one' }, { initializer: 'shared' })
  root(source, 'a', 'two', 'VariableDeclaration', { name: 'two' }, { initializer: 'shared' })
  node(source, 'a', 'shared', 'Literal', { value: 1 })
  root(source, 'a', 'cycle', 'Block', {}, { statements: ['cycle'] })
  root(source, 'a', 'foreign', 'VariableDeclaration', { name: 'foreign' }, { initializer: 'ownedByB' })
  root(source, 'b', 'ownedByB', 'Literal', { value: 3 })
  node(source, 'not-a-module', 'lost', 'Literal', { value: 4 })
  const result = analyzeProgram(source)
  assertDiagnostic(result, codes.missingNode, 'missing')
  assertDiagnostic(result, codes.multipleParents, 'shared')
  assertDiagnostic(result, codes.cycle, 'cycle')
  assertDiagnostic(result, codes.invalidModule, 'foreign')
  assertDiagnostic(result, codes.invalidModule, 'lost')
  assert.equal(result.ast.unassignedNodes[0].sourceId, 'lost')
})

test('sérialisation et reconstruction exactes, y compris champs inconnus et source invalide', () => {
  const source = twoModules()
  source.extension = { future: ['kept', null] }
  source.nodes[1].properties.extra = true
  source.modules[0].rootNodeIds.push(null)
  const serialized = serializeSource(source)
  assert.deepEqual(serialized.diagnostics, [])
  const decoded = deserializeSource(serialized.json)
  assert.deepEqual(decoded.source, source)
  assert.deepEqual(analyzeProgram(decoded.source).ast, analyzeProgram(source).ast)
  assert.deepEqual(analyzeProgram(decoded.source).diagnostics, analyzeProgram(source).diagnostics)
})

test('version future préservée, JSON illisible et valeurs non JSON refusées sans perte silencieuse', () => {
  const future = { ...program('m'), formatVersion: 99 }
  const decoded = deserializeSource(JSON.stringify(future))
  assert.deepEqual(decoded.source, future)
  assert.equal(decoded.diagnostics[0].code, codes.unsupportedVersion)
  assertDiagnostic(analyzeProgram(decoded.source), codes.unsupportedVersion, null)
  assert.equal(deserializeSource('{').source, null)
  for (const value of [undefined, NaN, Infinity, 1n, () => {}, new Date()]) {
    assert.equal(serializeSource({ value }).json, null)
  }
  const cycle = {}; cycle.self = cycle
  assert.equal(serializeSource(cycle).json, null)
})

test('source non mutée, traversée et inspection reproductibles', () => {
  const source = twoModules()
  const before = JSON.stringify(source)
  const first = analyzeProgram(source)
  const second = analyzeProgram(source)
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(source), before)
  const ids = []
  walkAst(first.ast, (entry) => ids.push(entry.sourceId))
  assert.deepEqual(new Set(ids), new Set(source.nodes.map((entry) => entry.id)))
  assert.equal(findAstNode(first.ast, 'absent'), null)
  assert.deepEqual(buildLogicalAst(source).diagnostics, [])
})

test('données JSON malformées et clés hostiles : erreurs contrôlées plutôt que crash', () => {
  for (const invalid of [null, [], 12, 'oops', {}, { id: 'p', formatVersion: 1, modules: {}, nodes: [null, false] }]) {
    const result = analyzeProgram(invalid)
    assert.equal(result.canGenerate, false)
    assert.ok(result.ast)
  }
  const source = program('m')
  root(source, 'm', 'badFunction', 'FunctionDeclaration', { name: 'f' }, { parameters: 'wrong', body: ['badBody'] })
  node(source, 'm', 'badBody', 'Literal', { value: 3 })
  source.nodes.push({ id: 'invalidKind', moduleId: 'm', kind: { toString: null }, properties: null, references: [], children: null })
  source.nodes.push({ id: 'missingId', moduleId: 'm', kind: 'Block', properties: {}, references: {}, children: { statements: [{ toString: null }] } })
  assert.doesNotThrow(() => analyzeProgram(source))
  const hostile = program('__proto__')
  root(hostile, '__proto__', 'constructor', 'VariableDeclaration', { name: '__proto__', type: stringType })
  assertValid(analyzeProgram(hostile))
})

// Chaque construction déclare un groupe visuel stable, sans dépendre des libellés affichés.
test('groupes visuels : chaque construction possède un groupe non vide', () => {
  for (const [kind, schema] of Object.entries(nodeSchema)) {
    assert.equal(typeof schema.group, 'string', kind)
    assert.ok(schema.group.length > 0, kind)
  }
})
