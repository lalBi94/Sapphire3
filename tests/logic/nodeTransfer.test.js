import test from 'node:test'
import assert from 'node:assert/strict'
import { captureSourceNode, pasteSourceNode, moveSourceNode, duplicateSourceNode, reorderSourceNode, analyzeProgram, simulateProgram, createContextIndex, deleteSourceNodes } from '../../src/utils/logic/index.js'
import { siblingOrder } from '../../src/utils/nodeTree.js'
import { program, root, node, intType, stringType, booleanType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const receiver = { kind: 'node', id: 'targetBody' }

// Prépare deux fonctions receveuses et une fonction avec paramètres/références internes.
function fixture() {
  const source = program('m', 'other')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['x', 'printX', 'printText', 'return'] })
  node(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: '1' })
  node(source, 'm', 'printX', 'PrintStatement', {}, { value: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'x' } })
  node(source, 'm', 'printText', 'PrintStatement', {}, { value: 'text' })
  node(source, 'm', 'text', 'Literal', { type: stringType, value: 'hello' })
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: null })
  root(source, 'm', 'worker', 'FunctionDeclaration', { name: 'work', type: intType }, { parameters: ['n'], body: 'workerBody' })
  node(source, 'm', 'n', 'Parameter', { name: 'n', type: intType })
  node(source, 'm', 'workerBody', 'Block', {}, { statements: ['returnN'] })
  node(source, 'm', 'returnN', 'ReturnStatement', {}, { argument: 'nRef' })
  node(source, 'm', 'nRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'n' } })
  root(source, 'other', 'target', 'FunctionDeclaration', { name: 'target', type: voidType }, { parameters: [], body: 'targetBody' })
  node(source, 'other', 'targetBody', 'Block', {}, { statements: [] })
  assert.deepEqual(analyzeProgram(source).diagnostics, [])
  return source
}

// Alloue des identifiants déterministes, en gardant les snapshots indépendants de la source.
function copy(source, id, prefix = 'copy') {
  const captured = captureSourceNode(source, id)
  assert.equal(captured.ok, true, captured.code)
  return { clipboard: captured.clipboard, ids: captured.clipboard.nodes.map((_, position) => `${prefix}-${position}`) }
}

test('collage : sous-arbre indépendant, fin de liste obligatoire et source non mutée', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const { clipboard, ids } = copy(source, 'printText')
  const result = pasteSourceNode(source, clipboard, receiver, { ids })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.nodeId, ids[0])
  assert.deepEqual(result.index.nodes.get('targetBody').children.statements, [ids[0]])
  assert.deepEqual(result.index.nodes.get(ids[0]).children, { value: ids[1] })
  assert.equal(result.index.nodes.get(ids[1]).moduleId, 'other')
  assert.equal(JSON.stringify(source), before)
  source.nodes.find(({ id }) => id === 'text').properties.value = 'changed'
  assert.equal(clipboard.nodes.find(({ kind }) => kind === 'Literal').properties.value, 'hello')
  assert.equal(result.index.nodes.get(ids[1]).properties.value, 'hello')
})

test('duplication : noms désambiguïsés, paramètres et références internes remappés', () => {
  const source = fixture()
  const { ids } = copy(source, 'worker')
  const result = duplicateSourceNode(source, 'worker', { ids })
  assert.equal(result.ok, true, JSON.stringify(result))
  const cloned = result.index.nodes.get(result.nodeId)
  assert.equal(cloned.properties.name, 'work2')
  const parameter = cloned.children.parameters[0]
  const clonedReference = result.transferredNodeIds.map((id) => result.index.nodes.get(id)).find(({ kind }) => kind === 'Reference')
  assert.deepEqual(clonedReference.references.target, { kind: 'node', nodeId: parameter })
  assert.notEqual(parameter, 'n')
  assert.equal(result.project.modules[0].rootNodeIds.at(-1), result.nodeId)
  assert.deepEqual(result.analysis.diagnostics, [])
})

test('duplication : le rôle de point d’entrée reste sur l’original et les variables prennent un nom libre', () => {
  const source = fixture()
  const entryCopy = copy(source, 'main')
  const result = duplicateSourceNode(source, 'main', { ids: entryCopy.ids })
  assert.equal(result.ok, true)
  assert.equal(result.index.nodes.get(result.nodeId).properties.entryPoint, false)
  assert.equal(result.project.nodes.filter((entry) => entry.properties.entryPoint === true).length, 1)
  const variableCopy = copy(source, 'x')
  const variableResult = duplicateSourceNode(source, 'x', { ids: variableCopy.ids })
  assert.equal(variableResult.ok, true)
  assert.equal(variableResult.index.nodes.get(variableResult.nodeId).properties.name, 'x2')
  assert.equal(variableResult.index.nodes.get('body').children.statements.at(-1), variableResult.nodeId)
  assert.deepEqual(simulateProgram(variableResult.project).output, ['1', 'hello'])
})

test('déplacement : identifiants conservés entre modules et rangement cohérent', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const result = moveSourceNode(source, 'printText', receiver)
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.nodeId, 'printText')
  assert.deepEqual(result.index.nodes.get('body').children.statements, ['x', 'printX', 'return'])
  assert.deepEqual(result.index.nodes.get('targetBody').children.statements, ['printText'])
  assert.equal(result.index.nodes.get('text').moduleId, 'other')
  assert.equal(result.project.nodes.length, source.nodes.length)
  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(result.analysis.diagnostics, [])
})

test('déplacement dans le même module : ajout en bas, sans opération vide', () => {
  const source = fixture()
  const result = moveSourceNode(source, 'printText', { kind: 'node', id: 'body' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.index.nodes.get('body').children.statements, ['x', 'printX', 'return', 'printText'])
  assert.equal(moveSourceNode(result.project, 'printText', { kind: 'node', id: 'body' }).code, 'TRANSFER_NO_CHANGE')
  assert.equal(moveSourceNode(source, 'one', { kind: 'node', id: 'x' }).ok, false)
})

test('receveurs : enfant unique occupé, genre incompatible et descendant refusés atomiquement', () => {
  const source = fixture()
  const { clipboard, ids } = copy(source, 'one')
  for (const target of [{ kind: 'node', id: 'printText' }, { kind: 'node', id: 'text' }, { kind: 'module', id: 'other' }]) {
    const result = pasteSourceNode(source, clipboard, target, { ids })
    assert.equal(result.ok, false)
    assert.equal(result.project, source)
  }
  assert.equal(moveSourceNode(source, 'main', { kind: 'node', id: 'body' }).code, 'TRANSFER_CYCLE')
  assert.equal(moveSourceNode(source, 'body', { kind: 'node', id: 'body' }).code, 'TRANSFER_CYCLE')
  const leafCopy = copy(source, 'one')
  assert.equal(duplicateSourceNode(source, 'one', { ids: leafCopy.ids }).ok, false)
})

test('receveurs : seul un slot réellement typé compatible est accepté et une ambiguïté est refusée', () => {
  const source = fixture()
  source.nodes.find(({ id }) => id === 'body').children.statements.unshift('if', 'printBinary')
  node(source, 'm', 'if', 'IfStatement', {}, { test: null, consequent: 'yes', alternate: null })
  node(source, 'm', 'yes', 'Block', {}, { statements: [] })
  node(source, 'm', 'printBinary', 'PrintStatement', {}, { value: 'binary' })
  node(source, 'm', 'binary', 'BinaryExpression', { operator: '+' }, { left: null, right: null })
  const integer = copy(source, 'one')
  assert.equal(pasteSourceNode(source, integer.clipboard, { kind: 'node', id: 'if' }, { ids: integer.ids }).ok, false)
  assert.equal(pasteSourceNode(source, integer.clipboard, { kind: 'node', id: 'binary' }, { ids: integer.ids }).code, 'TRANSFER_AMBIGUOUS')
  node(source, 'm', 'bool', 'Literal', { type: booleanType, value: true })
  source.nodes.find(({ id }) => id === 'if').children.test = 'bool'
  const boolean = copy(source, 'bool')
  source.nodes.find(({ id }) => id === 'if').children.test = null
  source.nodes = source.nodes.filter(({ id }) => id !== 'bool')
  const result = pasteSourceNode(source, boolean.clipboard, { kind: 'node', id: 'if' }, { ids: boolean.ids })
  assert.equal(result.ok, true)
  assert.equal(result.slot, 'test')
})

test('portées : références capturées et utilisateurs du nœud déplacé protégés', () => {
  const source = fixture()
  for (const id of ['printX', 'x']) {
    const result = moveSourceNode(source, id, receiver)
    assert.equal(result.ok, false, id)
    assert.equal(result.project, source)
  }
  const captured = copy(source, 'printX')
  const result = pasteSourceNode(source, captured.clipboard, receiver, { ids: captured.ids })
  assert.equal(result.ok, false)
  assert.equal(result.project, source)
})

test('références par nom : le collage ne se lie pas accidentellement à une variable homonyme', () => {
  const source = fixture()
  root(source, 'm', 'global', 'VariableDeclaration', { name: 'shared', type: intType }, { initializer: 'globalValue' })
  node(source, 'm', 'globalValue', 'Literal', { type: intType, value: '3' })
  source.nodes.find(({ id }) => id === 'xRef').references.target = { kind: 'name', name: 'shared' }
  source.nodes.find(({ id }) => id === 'x').properties.name = 'shared'
  const captured = copy(source, 'printX')
  assert.deepEqual(captured.clipboard.nodes.find(({ kind }) => kind === 'Reference').references.target, { kind: 'node', nodeId: 'x' })
  assert.equal(pasteSourceNode(source, captured.clipboard, receiver, { ids: captured.ids }).ok, false)
})

test('imports : appel exporté conservé et import automatique atomique dans le module cible', () => {
  const source = fixture()
  source.modules[0].exports.push({ nodeId: 'worker', name: 'work' })
  source.nodes.find(({ id }) => id === 'body').children.statements.unshift('callStatement')
  node(source, 'm', 'callStatement', 'ExpressionStatement', {}, { expression: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'workerRef', arguments: ['argument'] })
  node(source, 'm', 'workerRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'work' } })
  node(source, 'm', 'argument', 'Literal', { type: intType, value: '2' })
  const captured = copy(source, 'callStatement')
  const result = pasteSourceNode(source, captured.clipboard, receiver, { ids: captured.ids })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.project.modules[1].imports.length, 1)
  assert.equal(result.project.modules[1].imports[0].nodeId, 'worker')
  assert.equal(source.modules[1].imports.length, 0)
  assert.deepEqual(result.analysis.diagnostics, [])
  const movedExport = moveSourceNode(source, 'worker', { kind: 'module', id: 'other' })
  assert.equal(movedExport.ok, false)
  assert.equal(movedExport.project, source)
})

test('déplacement : fonction autonome entre modules autorisée, sans publication implicite', () => {
  const source = fixture()
  const result = moveSourceNode(source, 'worker', { kind: 'module', id: 'other' })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.index.nodes.get('n').moduleId, 'other')
  assert.equal(result.index.nodes.get('nRef').references.target.nodeId, 'n')
  assert.deepEqual(result.project.modules[0].exports, [])
  assert.deepEqual(result.project.modules[1].exports, [])
})

test('structure : enfants partagés, cycles, source absente, références non résolues et ids en conflit refusés', () => {
  const source = fixture()
  assert.equal(captureSourceNode(source, 'missing').ok, false)
  const captured = copy(source, 'printText')
  assert.equal(pasteSourceNode(source, captured.clipboard, receiver, { ids: ['main', 'text'] }).ok, false)
  source.nodes.find(({ id }) => id === 'xRef').references.target.name = 'missing'
  assert.equal(captureSourceNode(source, 'printX').code, 'TRANSFER_REFERENCE_UNRESOLVED')
  source.nodes.find(({ id }) => id === 'printX').children.value = 'text'
  assert.equal(captureSourceNode(source, 'printText').code, 'TRANSFER_STRUCTURE_INVALID')
  source.nodes.find(({ id }) => id === 'body').children.statements.push('body')
  assert.equal(captureSourceNode(source, 'main').ok, false)
})

test('presse-papiers : une référence externe supprimée après copie n’est pas réinterprétée', () => {
  const source = fixture()
  const captured = copy(source, 'printX')
  const removed = deleteSourceNodes(source, { kind: 'node', id: 'x' })
  const result = pasteSourceNode(removed.project, captured.clipboard, { kind: 'node', id: 'body' }, { ids: captured.ids })
  assert.equal(result.ok, false)
  assert.equal(result.project, removed.project)
})

test('contrôle : un break imbriqué ne peut pas sortir de sa boucle via déplacement du conteneur', () => {
  const source = fixture()
  source.nodes.find(({ id }) => id === 'body').children.statements.unshift('loop')
  node(source, 'm', 'loop', 'WhileStatement', {}, { test: 'test', body: 'loopBody' })
  node(source, 'm', 'test', 'Literal', { type: booleanType, value: false })
  node(source, 'm', 'loopBody', 'Block', {}, { statements: ['if'] })
  node(source, 'm', 'if', 'IfStatement', {}, { test: 'ifTest', consequent: 'ifBody', alternate: null })
  node(source, 'm', 'ifTest', 'Literal', { type: booleanType, value: true })
  node(source, 'm', 'ifBody', 'Block', {}, { statements: ['break'] })
  node(source, 'm', 'break', 'BreakStatement')
  const result = moveSourceNode(source, 'if', { kind: 'node', id: 'body' })
  assert.equal(result.ok, false)
  assert.equal(result.project, source)
})

test('index périmé : le transfert réanalyse la source effectivement reçue', () => {
  const source = fixture()
  const index = createContextIndex(source, analyzeProgram(source))
  const removed = deleteSourceNodes(source, { kind: 'node', id: 'targetBody' })
  const result = moveSourceNode(removed.project, 'printText', receiver, { index })
  assert.equal(result.ok, false)
  assert.equal(result.project, removed.project)
})

test('références entrantes par nom : aucun rebinding silencieux après déplacement', () => {
  const source = fixture()
  root(source, 'm', 'globalX', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'globalOne' })
  node(source, 'm', 'globalOne', 'Literal', { type: intType, value: '9' })
  source.nodes.find(({ id }) => id === 'body').children.statements.unshift('nested')
  node(source, 'm', 'nested', 'Block', {}, { statements: [] })
  const result = moveSourceNode(source, 'x', { kind: 'node', id: 'nested' })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'TRANSFER_REFERENCES_CHANGED')
  assert.equal(result.project, source)
})

test('copies : récursion interne et annotations de type nommé gardent les bonnes cibles', () => {
  const source = fixture()
  source.nodes.find(({ id }) => id === 'returnN').children.argument = 'recurse'
  node(source, 'm', 'recurse', 'CallExpression', {}, { callee: 'self', arguments: ['nRef'] })
  node(source, 'm', 'self', 'Reference', {}, {}, { target: { kind: 'name', name: 'work' } })
  const captured = copy(source, 'worker')
  const duplicate = duplicateSourceNode(source, 'worker', { ids: captured.ids })
  assert.equal(duplicate.ok, true)
  const self = duplicate.transferredNodeIds.map((id) => duplicate.index.nodes.get(id)).find((entry) => entry.kind === 'Reference' && entry.references.target.nodeId === duplicate.nodeId)
  assert.ok(self)
  root(source, 'm', 'alias', 'TypeDeclaration', { name: 'Count', type: intType })
  source.nodes.find(({ id }) => id === 'x').properties.type = { kind: 'named', target: { kind: 'name', name: 'Count' } }
  const typed = copy(source, 'x')
  const result = duplicateSourceNode(source, 'x', { ids: typed.ids })
  assert.equal(result.ok, true)
  assert.deepEqual(result.index.nodes.get(result.nodeId).properties.type.target, { kind: 'node', nodeId: 'alias' })
})

test('état incomplet représentable : copie sans valeur permise, capture de presse-papiers invalide refusée', () => {
  const source = fixture()
  delete source.nodes.find(({ id }) => id === 'text').properties.value
  const captured = copy(source, 'printText')
  const pasted = pasteSourceNode(source, captured.clipboard, receiver, { ids: captured.ids })
  assert.equal(pasted.ok, true)
  assert.equal(Object.hasOwn(pasted.index.nodes.get(captured.ids[1]).properties, 'value'), false)
  for (const clipboard of [null, {}, { version: 1, rootId: 'x', nodes: [null] }, { ...captured.clipboard, nodes: [...captured.clipboard.nodes, captured.clipboard.nodes[0]] }]) {
    assert.equal(pasteSourceNode(source, clipboard, receiver, { ids: [] }).ok, false)
  }
})

test('réordonnancement : les instructions changent de position sans changer d’identifiant', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const index = createContextIndex(source, analyzeProgram(source))
  assert.deepEqual(siblingOrder(index, 'printX'), { position: 1, count: 4 })
  assert.equal(siblingOrder(index, 'body'), null, 'un slot unique ne se réordonne pas')

  const up = reorderSourceNode(source, 'printText', -1, { index })
  assert.equal(up.ok, true, JSON.stringify(up))
  assert.deepEqual(up.project.nodes.find((node) => node.id === 'body').children.statements, ['x', 'printText', 'printX', 'return'])
  assert.equal(JSON.stringify(source), before, 'la source d’origine n’est pas mutée')
  assert.deepEqual(up.analysis.diagnostics, [])
  assert.ok(up.analysis.semantic.references.some((entry) => entry.nodeId === 'xRef'), 'les références restent résolues')

  const down = reorderSourceNode(up.project, 'printText', 1, { index: up.index })
  assert.deepEqual(down.project.nodes.find((node) => node.id === 'body').children.statements, ['x', 'printX', 'printText', 'return'])

  const roots = reorderSourceNode(source, 'worker', -1, { index })
  assert.deepEqual(roots.project.modules.find((module) => module.id === 'm').rootNodeIds, ['worker', 'main'])

  const boundary = reorderSourceNode(source, 'x', -1, { index })
  assert.equal(boundary.ok, false)
  assert.equal(boundary.code, 'REORDER_BOUNDARY')
  assert.equal(boundary.project, source)

  const single = reorderSourceNode(source, 'body', 1, { index })
  assert.equal(single.ok, false)
  assert.equal(single.code, 'REORDER_NOT_A_LIST')
})
