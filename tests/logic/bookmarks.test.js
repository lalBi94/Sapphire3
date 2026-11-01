import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, captureBookmark, insertBookmark } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Fonction pure : récursive, sans affichage ni dépendance extérieure.
function pureFunction() {
  const source = program('m')
  root(source, 'm', 'factorial', 'FunctionDeclaration', { name: 'factorial', type: intType }, { parameters: ['n'], body: 'body' })
  node(source, 'm', 'n', 'Parameter', { name: 'n', type: intType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['ret'] })
  node(source, 'm', 'ret', 'ReturnStatement', {}, { argument: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'callee', arguments: ['nRef'] })
  node(source, 'm', 'callee', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'factorial' } })
  node(source, 'm', 'nRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'n' } })
  return source
}

// Identifiants neufs déterministes pour l'insertion, comme ceux du hook React.
function freshIds(bookmark, prefix) {
  return bookmark.nodes.map((_, index) => `${prefix}-${index}`)
}

test('favori : une fonction pure est capturée avec ses nœuds et sa racine', () => {
  const source = pureFunction()
  const result = captureBookmark(source, { kind: 'node', id: 'factorial' }, { analysis: analyzeProgram(source) })
  assert.equal(result.ok, true)
  assert.equal(result.bookmark.kind, 'function')
  assert.equal(result.bookmark.name, 'factorial')
  assert.deepEqual(result.bookmark.rootNodeIds, ['factorial'])
  assert.ok(result.bookmark.nodes.some((entry) => entry.id === 'body'))
})

test('favori : une cible impure est refusée sans capture', () => {
  const source = pureFunction()
  root(source, 'm', 'total', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  source.nodes.find((entry) => entry.id === 'body').children.statements.push('print')
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'totalRef' })
  node(source, 'm', 'totalRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'total' } })
  const result = captureBookmark(source, { kind: 'node', id: 'factorial' }, { analysis: analyzeProgram(source) })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'BOOKMARK_IMPURE')
})

test('favori : un module pur est capturé avec toutes ses racines', () => {
  const source = pureFunction()
  const result = captureBookmark(source, { kind: 'module', id: 'm' }, { analysis: analyzeProgram(source) })
  assert.equal(result.ok, true)
  assert.equal(result.bookmark.kind, 'module')
  assert.deepEqual(result.bookmark.rootNodeIds, ['factorial'])
})

test('favori : l’insertion crée un nouveau module et remappe enfants et références', () => {
  const source = pureFunction()
  const bookmark = { id: 'b1', savedAt: 0, ...captureBookmark(source, { kind: 'node', id: 'factorial' }).bookmark }
  const target = program('other')
  const ids = freshIds(bookmark, 'fav')
  const result = insertBookmark(target, bookmark, { moduleId: 'favourite', moduleName: 'Favourite', ids })
  assert.equal(result.ok, true)
  const module = result.project.modules.find((entry) => entry.id === 'favourite')
  assert.equal(module.name, 'Favourite')
  assert.equal(module.rootNodeIds.length, 1)
  const rootId = module.rootNodeIds[0]
  const remapped = new Set(ids)
  assert.equal(result.project.nodes.find((entry) => entry.id === rootId).moduleId, 'favourite')
  for (const entry of result.project.nodes.filter((candidate) => remapped.has(candidate.id))) {
    for (const target_ of [entry.references?.target, entry.properties?.type?.target]) {
      if (target_?.kind === 'node') assert.ok(remapped.has(target_.nodeId), 'aucune référence ne pointe vers l’ancien projet')
    }
  }
  const owned = new Set([...ids, 'favourite'])
  const errors = analyzeProgram(result.project).diagnostics.filter((entry) => entry.severity === 'error' && owned.has(entry.location?.nodeId))
  assert.deepEqual(errors, [])
})

test('favori : une copie ne reprend jamais le rôle de point d’entrée', () => {
  const source = program('m')
  root(source, 'm', 'start', 'FunctionDeclaration', { name: 'start', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: [] })
  const bookmark = { id: 'b2', savedAt: 0, ...captureBookmark(source, { kind: 'node', id: 'start' }).bookmark }
  const result = insertBookmark(program('other'), bookmark, { moduleId: 'copy', moduleName: 'Copy', ids: freshIds(bookmark, 'copy') })
  assert.equal(result.ok, true)
  const copied = result.project.nodes.find((entry) => entry.id === result.rootNodeIds[0])
  assert.equal(copied.properties.entryPoint, false)
})

test('favori : une entrée mal formée est refusée', () => {
  const target = program('other')
  assert.equal(insertBookmark(target, { version: 1, nodes: [] }, { moduleId: 'm', moduleName: 'M', ids: [] }).code, 'BOOKMARK_INVALID')
  assert.equal(insertBookmark(target, { version: 1, nodes: [{ id: 'a' }], rootNodeIds: ['a'] }, { moduleId: 'm', moduleName: 'M', ids: [] }).code, 'BOOKMARK_INVALID')
})
