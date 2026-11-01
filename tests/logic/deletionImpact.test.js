import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, deletionImpact } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// `helper` est appelé deux fois et référencé une fois ; `x` est référencé une fois ; `spare` sert personne.
function usageProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['xDecl', 'useX', 'useH', 'callOne', 'callTwo'] })
  node(source, 'm', 'xDecl', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'useX', 'PrintStatement', {}, { value: 'xRef' })
  node(source, 'm', 'xRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'xDecl' } })
  node(source, 'm', 'useH', 'PrintStatement', {}, { value: 'hRef' })
  node(source, 'm', 'hRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'helper' } })
  node(source, 'm', 'callOne', 'PrintStatement', {}, { value: 'callA' })
  node(source, 'm', 'callA', 'CallExpression', {}, { callee: 'calleeA', arguments: [] })
  node(source, 'm', 'calleeA', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'helper' } })
  node(source, 'm', 'callTwo', 'PrintStatement', {}, { value: 'callB' })
  node(source, 'm', 'callB', 'CallExpression', {}, { callee: 'calleeB', arguments: [] })
  node(source, 'm', 'calleeB', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'helper' } })
  root(source, 'm', 'helper', 'FunctionDeclaration', { name: 'helper', type: intType }, { parameters: [], body: 'helperBody' })
  node(source, 'm', 'helperBody', 'Block', {}, { statements: [] })
  root(source, 'm', 'spare', 'FunctionDeclaration', { name: 'spare', type: voidType }, { parameters: [], body: 'spareBody' })
  node(source, 'm', 'spareBody', 'Block', {}, { statements: [] })
  return source
}

// Mesure l'impact avec l'index courant, comme le fait l'interface au clic.
function impactOf(project, id) {
  const analysis = analyzeProgram(project)
  return deletionImpact(project, { kind: 'node', id }, { analysis, index: createContextIndex(project, analysis) })
}

test('impact de suppression : appels et références d’une fonction', () => {
  const impact = impactOf(usageProgram(), 'helper')
  assert.equal(impact.ok, true)
  assert.equal(impact.calls, 2)
  assert.equal(impact.references, 1)
  assert.equal(impact.imports, 0)
  assert.equal(impact.total, 3)
})

test('impact de suppression : une variable référencée une fois', () => {
  const impact = impactOf(usageProgram(), 'xDecl')
  assert.equal(impact.calls, 0)
  assert.equal(impact.references, 1)
  assert.equal(impact.total, 1)
})

test('impact de suppression : aucune casse pour une déclaration isolée', () => {
  const impact = impactOf(usageProgram(), 'spare')
  assert.equal(impact.total, 0)
  assert.equal(impact.removedCount, 2, 'la fonction et son bloc')
})

test('impact de suppression : un appel et un import depuis un autre module', () => {
  const source = program('lib', 'app')
  root(source, 'lib', 'square', 'FunctionDeclaration', { name: 'square', type: intType }, { parameters: [], body: 'squareBody' })
  node(source, 'lib', 'squareBody', 'Block', {}, { statements: ['returnOne'] })
  node(source, 'lib', 'returnOne', 'ReturnStatement', {}, { argument: 'one' })
  node(source, 'lib', 'one', 'Literal', { type: intType, value: 1 })
  source.modules[0].exports.push({ nodeId: 'square', name: 'square' })
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'app', 'body', 'Block', {}, { statements: ['print'] })
  node(source, 'app', 'print', 'PrintStatement', {}, { value: 'call' })
  node(source, 'app', 'call', 'CallExpression', {}, { callee: 'callee', arguments: [] })
  node(source, 'app', 'callee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'squareImport' } })
  source.modules[1].imports.push({ id: 'squareImport', moduleId: 'lib', nodeId: 'square', localName: 'square' })
  const impact = impactOf(source, 'square')
  assert.equal(impact.calls, 1, 'l’appel d’un autre module casse')
  assert.equal(impact.imports, 1, 'l’import devient orphelin')
  assert.equal(impact.total, 2)
})
