import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDependencyGraph, buildControlFlowGraph, analyzeProgram, createContextIndex } from '../../src/utils/logic/index.js'
import { debugFixture, node, root, twoModules, intType } from './fixtures.js'

// Retrouve une arête sans dépendre de l'ordre de rangement des sommets.
function hasEdge(graph, from, to, kind) {
  return graph.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind)
}

test('graphes : dépendances, appels entrants/sortants, lectures et écritures sans mutation', () => {
  const project = debugFixture()
  const before = JSON.stringify(project)
  const graph = buildDependencyGraph(project, { kind: 'node', id: 'twice' })
  assert.equal(graph.ok, true)
  assert.equal(hasEdge(graph, 'call', 'twice', 'calls'), true)
  assert.equal(hasEdge(graph, 'gRef', 'g', 'reads'), true)
  assert.equal(hasEdge(graph, 'gTarget', 'g', 'writes'), true)
  assert.equal(hasEdge(graph, 'twice', 'n', 'contains'), true)
  assert.equal(graph.nodes.find(({ id }) => id === 'g').external, true)
  assert.equal(JSON.stringify(project), before)
  assert.equal(new Set(graph.nodes.map(({ id }) => id)).size, graph.nodes.length)
})

test('graphes : import résolu vers la déclaration source et référence absente signalée', () => {
  const project = twoModules()
  const graph = buildDependencyGraph(project, { kind: 'module', id: 'app' })
  assert.equal(hasEdge(graph, 'answerReference', 'answer', 'reads'), true)
  project.nodes.find(({ id }) => id === 'answerReference').references.target.importId = 'missing'
  assert.deepEqual(buildDependencyGraph(project, { kind: 'node', id: 'result' }).unresolvedNodeIds, ['answerReference'])
})

test('graphes : les alias de type sont des dépendances résolues, sans seconde résolution des noms', () => {
  const project = debugFixture()
  root(project, 'm', 'alias', 'TypeDeclaration', { name: 'Count', type: intType })
  project.nodes.find(({ id }) => id === 'g').properties.type = { kind: 'named', target: { kind: 'node', nodeId: 'alias' } }
  const graph = buildDependencyGraph(project, { kind: 'node', id: 'g' })
  assert.equal(hasEdge(graph, 'g', 'alias', 'type'), true)
})

test('CFG : fonction englobante, branches, retours et code déconnecté après return', () => {
  const project = debugFixture()
  const graph = buildControlFlowGraph(project, { kind: 'node', id: 'true' })
  assert.equal(graph.ok, true)
  assert.equal(graph.rootId, 'main')
  assert.equal(hasEdge(graph, 'cfg:entry', 'local', 'next'), true)
  assert.equal(hasEdge(graph, 'condition', 'inner', 'true'), true)
  assert.equal(hasEdge(graph, 'condition', 'printAfter', 'false'), true)
  assert.equal(hasEdge(graph, 'returnMain', 'cfg:exit', 'return'), true)
  assert.equal(graph.nodes.find(({ id }) => id === 'deadPrint').reachable, false)
  assert.equal(graph.nodes.some(({ id }) => id === 'returnTwice'), false)
})

test('CFG : boucle for, initialiseur, update expression, continue et break', () => {
  const project = debugFixture()
  project.nodes.find(({ id }) => id === 'mainBody').children.statements = ['loop', 'printAfter', 'returnMain', 'deadPrint']
  project.nodes = project.nodes.filter(({ id }) => !['local', 'two', 'condition', 'true', 'branch', 'inner', 'three', 'callPrint', 'call', 'callee', 'argument'].includes(id))
  project.nodes.find(({ id }) => id === 'printAfter').children.value = 'oneMore'
  node(project, 'm', 'oneMore', 'Literal', { type: intType, value: 1 })
  node(project, 'm', 'loop', 'ForStatement', {}, { initializer: 'init', test: null, update: 'update', body: 'loopBody' })
  node(project, 'm', 'init', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'zero' })
  node(project, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  node(project, 'm', 'update', 'Literal', { type: intType, value: 1 })
  node(project, 'm', 'loopBody', 'Block', {}, { statements: ['branchLoop'] })
  node(project, 'm', 'branchLoop', 'IfStatement', {}, { test: 'test', consequent: 'yes', alternate: 'no' })
  node(project, 'm', 'test', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  node(project, 'm', 'yes', 'Block', {}, { statements: ['continue'] })
  node(project, 'm', 'no', 'Block', {}, { statements: ['break'] })
  node(project, 'm', 'continue', 'ContinueStatement')
  node(project, 'm', 'break', 'BreakStatement')
  const graph = buildControlFlowGraph(project, { kind: 'node', id: 'update' })
  assert.equal(hasEdge(graph, 'cfg:entry', 'init', 'next'), true)
  assert.equal(hasEdge(graph, 'init', 'loop', 'next'), true)
  assert.equal(hasEdge(graph, 'continue', 'update', 'continue'), true)
  assert.equal(hasEdge(graph, 'update', 'loop', 'next'), true)
  assert.equal(hasEdge(graph, 'break', 'printAfter', 'break'), true)
  assert.equal(graph.edges.some(({ from, kind }) => from === 'loop' && kind === 'false'), false)
})

test('CFG : while imbriqués, continue et break ciblent la boucle la plus proche', () => {
  const project = debugFixture()
  project.nodes.find(({ id }) => id === 'mainBody').children.statements.unshift('outer')
  node(project, 'm', 'outer', 'WhileStatement', {}, { test: 'outerTest', body: 'outerBody' })
  node(project, 'm', 'outerTest', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  node(project, 'm', 'outerBody', 'Block', {}, { statements: ['innerLoop', 'outerContinue'] })
  node(project, 'm', 'outerContinue', 'ContinueStatement')
  node(project, 'm', 'innerLoop', 'WhileStatement', {}, { test: 'innerTest', body: 'innerBody' })
  node(project, 'm', 'innerTest', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  node(project, 'm', 'innerBody', 'Block', {}, { statements: ['innerBreak'] })
  node(project, 'm', 'innerBreak', 'BreakStatement')
  const graph = buildControlFlowGraph(project, { kind: 'node', id: 'outer' })
  assert.equal(hasEdge(graph, 'innerBreak', 'outerContinue', 'break'), true)
  assert.equal(hasEdge(graph, 'outerContinue', 'outer', 'continue'), true)
  assert.equal(hasEdge(graph, 'outer', 'local', 'false'), true)
})

test('graphes : initialisation de module, index réutilisé et cible supprimée refusée', () => {
  const project = debugFixture()
  const index = createContextIndex(project, analyzeProgram(project))
  const graph = buildControlFlowGraph(project, { kind: 'module', id: 'm' }, index)
  assert.equal(graph.scope, 'module')
  assert.equal(hasEdge(graph, 'cfg:entry', 'g', 'next'), true)
  assert.equal(hasEdge(graph, 'g', 'cfg:exit', 'next'), true)
  for (const build of [buildControlFlowGraph, buildDependencyGraph]) {
    assert.equal(build(project, { kind: 'node', id: 'missing' }).ok, false)
    assert.equal(build(null, { kind: 'node', id: 'missing' }).ok, false)
  }
})

test('graphes : récursion finie à analyser, boucle vide et identifiants virtuels sans collision', () => {
  const project = debugFixture()
  project.nodes.find(({ id }) => id === 'twiceBody').children.statements.unshift('recursiveStatement')
  node(project, 'm', 'recursiveStatement', 'ExpressionStatement', {}, { expression: 'recursiveCall' })
  node(project, 'm', 'recursiveCall', 'CallExpression', {}, { callee: 'recursiveRef', arguments: ['recursiveArg'] })
  node(project, 'm', 'recursiveRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'twice' } })
  node(project, 'm', 'recursiveArg', 'Literal', { type: intType, value: 1 })
  const graph = buildDependencyGraph(project, { kind: 'node', id: 'twice' })
  assert.equal(hasEdge(graph, 'recursiveCall', 'twice', 'calls'), true)
  project.nodes.find(({ id }) => id === 'mainBody').children.statements.unshift('cfg:entry')
  node(project, 'm', 'cfg:entry', 'ForStatement', {}, { initializer: null, test: null, update: null, body: 'empty' })
  node(project, 'm', 'empty', 'Block', {}, { statements: [] })
  const flow = buildControlFlowGraph(project, { kind: 'node', id: 'main' })
  assert.equal(flow.nodes[0].kind, 'entry')
  assert.notEqual(flow.nodes[0].id, 'cfg:entry')
  assert.equal(hasEdge(flow, 'cfg:entry', 'cfg:entry', 'next'), true)
  assert.equal(flow.nodes.find(({ id }) => id === 'local').reachable, false)
  assert.equal(new Set(flow.nodes.map(({ id }) => id)).size, flow.nodes.length)
})
