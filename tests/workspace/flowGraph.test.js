import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, analyzeReachability, createContextIndex } from '../../src/utils/logic/index.js'
import { buildFlowGraph } from '../../src/utils/flowGraph.js'
import { debugFixture, node, intType } from '../logic/fixtures.js'

// Prépare l'index et l'accessibilité nécessaires au graphe de flux.
function flowFor(project) {
  const analysis = analyzeProgram(project)
  return { analysis, index: createContextIndex(project, analysis), reachability: analyzeReachability(project, analysis) }
}

test('flux graphique : seules les fonctions atteignables et leurs appels sont conservés', () => {
  const project = debugFixture()
  const { index, reachability } = flowFor(project)
  const graph = buildFlowGraph(project, index, reachability)
  assert.deepEqual(graph.nodes.map((entry) => entry.name), ['start', 'twice'])
  assert.equal(graph.nodes.find((entry) => entry.id === 'main').entry, true)
  assert.deepEqual(graph.edges.map((edge) => [edge.fromId, edge.toId, edge.count]), [['main', 'twice', 1]])
  assert.ok(graph.nodes.find((entry) => entry.id === 'main').x < graph.nodes.find((entry) => entry.id === 'twice').x)
  assert.ok(graph.width > 0 && graph.height > 0)
  assert.ok(!graph.nodes.some((entry) => entry.id === 'unused'), 'la fonction inatteignable est ignorée')
})

test('flux graphique : appel récursif signalé sans lien bouclé et graphe vide sûr', () => {
  const project = debugFixture()
  project.nodes.find((entry) => entry.id === 'twiceBody').children.statements.unshift('selfCall')
  node(project, 'm', 'selfCall', 'ExpressionStatement', {}, { expression: 'selfExpression' })
  node(project, 'm', 'selfExpression', 'CallExpression', {}, { callee: 'selfReference', arguments: ['selfArgument'] })
  node(project, 'm', 'selfReference', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'twice' } })
  node(project, 'm', 'selfArgument', 'Literal', { type: intType, value: 1 })
  const { index, reachability } = flowFor(project)
  const graph = buildFlowGraph(project, index, reachability)
  assert.equal(graph.nodes.find((entry) => entry.id === 'twice').recursive, true)
  assert.ok(!graph.edges.some((edge) => edge.fromId === 'twice' && edge.toId === 'twice'))
  assert.deepEqual(buildFlowGraph(project, index, { ok: false, functions: [], reachableNodeIds: [] }), { nodes: [], edges: [], width: 0, height: 0 })
})
