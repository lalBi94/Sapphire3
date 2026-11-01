import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzePurity, getPureIds } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Fonction récursive qui n'utilise que son paramètre : aucun nœud extérieur.
function pureRecursion() {
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

// Ajoute une déclaration globale et une lecture de ce global dans le corps.
function withExternalRead(source) {
  root(source, 'm', 'total', 'VariableDeclaration', { name: 'total', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  source.nodes.find((entry) => entry.id === 'body').children.statements.push('readTotal')
  node(source, 'm', 'readTotal', 'PrintStatement', {}, { value: 'totalRef' })
  node(source, 'm', 'totalRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'total' } })
  return source
}

test('pureté : une fonction qui ne dépend que de ses paramètres est pure', () => {
  const source = pureRecursion()
  const purity = analyzePurity(source, { kind: 'node', id: 'factorial' })
  assert.equal(purity.ok, true)
  assert.equal(purity.pure, true)
  assert.deepEqual(purity.externalNodeIds, [])
  assert.deepEqual(purity.sideEffectNodeIds, [])
})

test('pureté : une dépendance extérieure retire la pureté', () => {
  const source = pureRecursion()
  withExternalRead(source)
  const purity = analyzePurity(source, { kind: 'node', id: 'factorial' })
  assert.equal(purity.pure, false)
  assert.ok(purity.externalNodeIds.includes('total'), 'la variable globale est externe au sous-arbre')
})

test('pureté : un affichage est un effet de bord', () => {
  const source = program('m')
  root(source, 'm', 'show', 'FunctionDeclaration', { name: 'show', type: voidType }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['print', 'ret'] })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'ret', 'ReturnStatement', {}, { argument: null })
  const purity = analyzePurity(source, { kind: 'node', id: 'show' })
  assert.equal(purity.pure, false)
  assert.deepEqual(purity.sideEffectNodeIds, ['print'])
})

test('pureté : un module sans affichage ni import est pur, sinon non', () => {
  const pure = pureRecursion()
  assert.equal(analyzePurity(pure, { kind: 'module', id: 'm' }).pure, true, 'référence interne à un global du même module')

  const withPrint = program('m')
  root(withPrint, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(withPrint, 'm', 'body', 'Block', {}, { statements: ['print'] })
  node(withPrint, 'm', 'print', 'PrintStatement', {}, { value: 'one' })
  node(withPrint, 'm', 'one', 'Literal', { type: intType, value: 1 })
  assert.equal(analyzePurity(withPrint, { kind: 'module', id: 'm' }).pure, false)
})

test('pureté : getPureIds distingue fonctions et modules purs', () => {
  const source = pureRecursion()
  withExternalRead(source)
  root(source, 'm', 'clean', 'FunctionDeclaration', { name: 'clean', type: voidType }, { parameters: [], body: 'cleanBody' })
  node(source, 'm', 'cleanBody', 'Block', {}, { statements: [] })
  const pure = getPureIds(source)
  assert.ok(pure.functions.has('clean'))
  assert.ok(!pure.functions.has('factorial'), 'une lecture externe retire la fonction de la liste')
  assert.ok(!pure.modules.has('m'), 'le module contient un affichage, donc il n’est pas pur')
})
