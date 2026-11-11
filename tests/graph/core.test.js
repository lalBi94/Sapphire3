import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GRAPH_API_VERSION,
  GRAPH_ERROR_CODES,
  GRAPH_FORMATS,
  GRAPH_VERSION,
  GraphError,
  analyzeGraph,
  exportGraph,
  getAstGraph,
  getCallGraph,
  getControlFlowGraph,
  getDependencyGraph,
  getFlowGraph,
  isGraphError,
} from '../../packages/graph/src/index.js'
import {
  addFunction,
  addImport,
  addModule,
  createNode,
  createProject,
  drafts,
  setExport,
  types,
} from '../../packages/core/src/index.js'
import { buildControlFlowGraph, buildDependencyGraph } from '../../src/utils/logic/index.js'
import { examples } from '../../src/utils/examples.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'
import { debugFixture } from '../logic/fixtures.js'

// Vérifie la présence d'une arête typée.
function hasEdge(graph, from, to, kind) {
  return graph.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind)
}

// Construit un petit graphe synthétique pour les analyses et exports.
function syntheticGraph() {
  return {
    ok: true,
    kind: 'test',
    directed: true,
    nodes: [
      { id: 'a', label: 'A', kind: 'module' },
      { id: 'b', label: 'B', kind: 'module' },
      { id: 'c', label: 'C', kind: 'module' },
      { id: 'd', label: 'D', kind: 'module' },
    ],
    edges: [
      { id: 'a-b', from: 'a', to: 'b', kind: 'calls' },
      { id: 'a-c', from: 'a', to: 'c', kind: 'calls' },
      { id: 'b-d', from: 'b', to: 'd', kind: 'calls' },
      { id: 'c-d', from: 'c', to: 'd', kind: 'calls' },
    ],
    metadata: {
      kind: 'test', projectId: 'synthetic', rootId: 'a', rootKind: 'node', scope: 'project',
      incomplete: false, nodeCount: 4, edgeCount: 4, diagnostics: [], unresolvedNodeIds: [],
    },
  }
}

// Construit un graphe cyclique avec une boucle et un self-loop.
function cyclicGraph() {
  const graph = syntheticGraph()
  graph.nodes.push({ id: 'e', label: 'E', kind: 'module' })
  graph.edges = [
    { id: 'a-b', from: 'a', to: 'b', kind: 'calls' },
    { id: 'b-a', from: 'b', to: 'a', kind: 'calls' },
    { id: 'c-d', from: 'c', to: 'd', kind: 'calls' },
    { id: 'd-c', from: 'd', to: 'c', kind: 'calls' },
    { id: 'e-e', from: 'e', to: 'e', kind: 'calls' },
  ]
  graph.metadata.nodeCount = 5
  graph.metadata.edgeCount = 5
  return graph
}

test('graph : version, dépendances projet, imports/exports et déterminisme', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/graph/package.json', import.meta.url), 'utf8'))
  assert.equal(GRAPH_VERSION, packageJson.version)
  assert.equal(GRAPH_API_VERSION, 1)
  assert.deepEqual(GRAPH_FORMATS, ['json', 'dot', 'mermaid'])

  const project = examples.find((example) => example.id === 'imports').build().project
  const before = JSON.stringify(project)
  const graph = getDependencyGraph(project)
  assert.equal(graph.ok, true)
  assert.equal(graph.kind, 'dependency')
  assert.ok(graph.nodes.some((node) => node.id === 'module:app' && node.kind === 'module'))
  assert.ok(graph.nodes.some((node) => node.id === 'module:library' && node.kind === 'module'))
  assert.ok(graph.nodes.some((node) => node.id === 'square' && node.entity === 'symbol'))
  assert.equal(hasEdge(graph, 'module:app', 'module:library', 'imports'), true)
  assert.equal(hasEdge(graph, 'module:app', 'module:library', 'uses-export'), true)
  assert.equal(hasEdge(graph, 'module:library', 'square', 'exports'), true)
  assert.equal(hasEdge(graph, 'module:app', 'square', 'imports-symbol'), true)
  assert.equal(hasEdge(graph, 'appMain', 'square', 'calls'), true)
  assert.equal(graph.metadata.moduleLinks.length, 1)
  assert.equal(JSON.stringify(project), before)
  assert.deepEqual(getDependencyGraph(project), graph)

  const analysis = analyzeGraph(graph, { from: 'module:app', edgeKinds: ['imports', 'uses-export'], direction: 'out' })
  assert.equal(analysis.ok, true)
  assert.deepEqual(analysis.reachableFrom.sort(), ['module:app', 'module:library'])
  assert.deepEqual(analysis.transitiveDependencies['module:app'], ['module:library'])
})

test('graph : cycles de modules et d’appels', () => {
  let project = createProject('cycle')
  project = addModule(project, { id: 'a', name: 'A' }).project
  project = addModule(project, { id: 'b', name: 'B' }).project
  const first = addFunction(project, 'a', {
    name: 'fa', returnType: types.void,
    body: [drafts.expressionStatement(drafts.call(drafts.reference('fb'), []))],
  })
  project = first.project
  const second = addFunction(project, 'b', {
    name: 'fb', returnType: types.void,
    body: [drafts.expressionStatement(drafts.call(drafts.reference('fa'), []))],
  })
  project = second.project
  project = setExport(project, 'a', first.nodeId, true).project
  project = setExport(project, 'b', second.nodeId, true).project
  project = addImport(project, 'a', { id: 'ifb', moduleId: 'b', nodeId: second.nodeId, localName: 'fb' }).project
  project = addImport(project, 'b', { id: 'ifa', moduleId: 'a', nodeId: first.nodeId, localName: 'fa' }).project

  const dependency = getDependencyGraph(project)
  assert.equal(hasEdge(dependency, 'module:a', 'module:b', 'imports'), true)
  assert.equal(hasEdge(dependency, 'module:b', 'module:a', 'imports'), true)
  const dependencyAnalysis = analyzeGraph(dependency)
  assert.equal(dependencyAnalysis.hasCycles, true)
  assert.ok(dependencyAnalysis.cycles.some((component) => component.includes('module:a') && component.includes('module:b')))
  assert.equal(dependencyAnalysis.topologicalOrder, null)

  const calls = getCallGraph(project)
  assert.equal(hasEdge(calls, 'a-FunctionDeclaration-1', 'b-FunctionDeclaration-1', 'calls'), true)
  assert.equal(hasEdge(calls, 'b-FunctionDeclaration-1', 'a-FunctionDeclaration-1', 'calls'), true)
  const callAnalysis = analyzeGraph(calls)
  assert.equal(callAnalysis.hasCycles, true)
  assert.ok(callAnalysis.cycles.some((component) => component.includes('a-FunctionDeclaration-1')))
})

test('graph : dépendances ciblées, CFG et compatibilité avec les graphes IDE', () => {
  const project = debugFixture()
  const rawDependency = buildDependencyGraph(project, { kind: 'node', id: 'twice' })
  const dependency = getDependencyGraph(project, { target: 'twice', scope: 'node' })
  assert.equal(dependency.ok, true)
  assert.equal(dependency.metadata.scope, 'node')
  assert.equal(dependency.metadata.rootId, 'twice')
  assert.deepEqual(dependency.nodes.map((node) => node.id), rawDependency.nodes.map((node) => node.id))
  assert.deepEqual(dependency.edges.map((edge) => [edge.from, edge.to, edge.kind]), rawDependency.edges.map((edge) => [edge.from, edge.to, edge.kind]))

  const rawCfg = buildControlFlowGraph(project, { kind: 'node', id: 'main' })
  const cfg = getControlFlowGraph(project, 'main')
  assert.equal(cfg.ok, true)
  assert.equal(cfg.kind, 'control-flow')
  assert.deepEqual(cfg.nodes.map((node) => node.id), rawCfg.nodes.map((node) => node.id))
  assert.deepEqual(cfg.edges.map((edge) => [edge.from, edge.to, edge.kind]), rawCfg.edges.map((edge) => [edge.from, edge.to, edge.kind]))
  assert.equal(hasEdge(cfg, 'condition', 'inner', 'true'), true)
  assert.equal(hasEdge(cfg, 'condition', 'printAfter', 'false'), true)
  assert.equal(hasEdge(cfg, 'returnMain', 'cfg:exit', 'return'), true)
  assert.equal(cfg.nodes.find((node) => node.id === 'deadPrint').reachable, false)
  assert.equal(cfg.metadata.incomplete, false)

  assert.equal(getControlFlowGraph(project, 'missing').code, GRAPH_ERROR_CODES.targetNotFound)
  assert.equal(getControlFlowGraph(project).code, GRAPH_ERROR_CODES.targetRequired)
  assert.equal(getDependencyGraph(project, { target: 'missing' }).code, GRAPH_ERROR_CODES.targetNotFound)
})

test('graph : boucles imbriquées, break, continue et code inaccessible', () => {
  const project = debugFixture()
  const add = (id, kind, properties = {}, children = {}) => createNode(id, 'm', kind, { properties, children })
  project.nodes.find((node) => node.id === 'mainBody').children.statements.unshift('outer')
  project.nodes.push(
    add('outer', 'WhileStatement', {}, { test: 'outerTest', body: 'outerBody' }),
    add('outerTest', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true }),
    add('outerBody', 'Block', {}, { statements: ['innerLoop', 'outerContinue'] }),
    add('outerContinue', 'ContinueStatement'),
    add('innerLoop', 'WhileStatement', {}, { test: 'innerTest', body: 'innerBody' }),
    add('innerTest', 'Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true }),
    add('innerBody', 'Block', {}, { statements: ['innerBreak'] }),
    add('innerBreak', 'BreakStatement'),
  )
  const cfg = getControlFlowGraph(project, 'outer')
  assert.equal(cfg.ok, true)
  assert.equal(hasEdge(cfg, 'innerBreak', 'outerContinue', 'break'), true)
  assert.equal(hasEdge(cfg, 'outerContinue', 'outer', 'continue'), true)
  assert.equal(hasEdge(cfg, 'outer', 'local', 'false'), true)
  assert.equal(cfg.metadata.incomplete, false)
})

test('graph : call graph, récursion, classes et méthodes', () => {
  const recursion = examples.find((example) => example.id === 'recursion').build().project
  const recursive = getCallGraph(recursion)
  assert.equal(recursive.ok, true)
  assert.ok(recursive.nodes.some((node) => node.id === 'factorial' && node.kind === 'function'))
  assert.equal(hasEdge(recursive, 'factorial', 'factorial', 'calls'), true)
  const recursiveAnalysis = analyzeGraph(recursive)
  assert.equal(recursiveAnalysis.hasCycles, true)
  assert.ok(recursiveAnalysis.cycles.some((component) => component.includes('factorial')))
  assert.equal(recursiveAnalysis.topologicalOrder, null)

  const classes = workspaceTemplates.find((template) => template.id === 'classInstance').build().project
  const callGraph = getCallGraph(classes)
  assert.ok(callGraph.nodes.some((node) => node.name === 'constructor' && node.kind === 'method' && node.className === 'Counter'))
  assert.ok(callGraph.nodes.some((node) => node.name === 'add' && node.className === 'Counter'))
  assert.ok(callGraph.nodes.some((node) => node.name === 'get' && node.className === 'Counter'))
  assert.equal(callGraph.nodes.find((node) => node.name === 'add').reachable, true)
  assert.equal(callGraph.nodes.find((node) => node.name === 'get').reachable, true)
  assert.equal(hasEdge(callGraph, 'templateClassMain', 'templateCounterClass:9', 'calls'), true)
  assert.equal(hasEdge(callGraph, 'templateClassMain', 'templateCounterClass:19', 'calls'), true)
  assert.equal(hasEdge(callGraph, 'templateClassMain', 'templateCounterClass:24', 'calls'), true)
  assert.ok(callGraph.edges.some((edge) => edge.callKinds?.includes('constructor')))
  assert.ok(callGraph.edges.some((edge) => edge.callKinds?.includes('method')))
})

test('graph : call graph indirect, lambdas et cibles non déterminables', () => {
  let project = createProject('indirect')
  project = addModule(project, { id: 'app', name: 'App' }).project
  project = addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('f', { kind: 'function', parameters: [types.int], returnType: types.int }, drafts.lambda({
        returnType: types.int,
        parameters: [{ name: 'x', type: types.int }],
        body: drafts.binary('*', drafts.reference('x'), drafts.literal(types.int, 2)),
      })),
      drafts.print(drafts.call(drafts.reference('f'), [drafts.literal(types.int, 21)])),
      drafts.print(drafts.call(drafts.lambda({
        returnType: types.int,
        parameters: [{ name: 'y', type: types.int }],
        body: drafts.reference('y'),
      }), [drafts.literal(types.int, 3)])),
    ],
  }).project

  const graph = getCallGraph(project)
  assert.equal(graph.ok, true)
  assert.ok(graph.nodes.some((node) => node.kind === 'lambda'))
  assert.ok(graph.nodes.some((node) => node.kind === 'unresolved-call' && node.reason === 'function-reference'))
  assert.ok(graph.edges.some((edge) => edge.kind === 'calls' && edge.callKinds?.includes('lambda')))
  assert.ok(graph.edges.some((edge) => edge.kind === 'calls-indirect' && edge.resolution === 'indirect'))
  assert.equal(graph.metadata.indirectCallNodeIds.length, 1)
  assert.equal(graph.metadata.incomplete, true)

  const strict = getCallGraph(project, { includeUnresolved: false })
  assert.equal(strict.nodes.some((node) => node.kind === 'unresolved-call'), false)
  assert.equal(strict.edges.some((edge) => edge.kind === 'calls-indirect'), false)
  assert.equal(strict.metadata.indirectCallNodeIds.length, 1)
})

test('graph : AST, hiérarchie, types et références distinctes', () => {
  const project = debugFixture()
  const graph = getAstGraph(project)
  assert.equal(graph.ok, true)
  assert.ok(graph.nodes.some((node) => node.id === 'project:debug' && node.kind === 'project'))
  assert.ok(graph.nodes.some((node) => node.id === 'module:m' && node.kind === 'module'))
  assert.ok(graph.nodes.some((node) => node.id === 'main' && node.kind === 'FunctionDeclaration'))
  assert.ok(graph.nodes.some((node) => node.id === 'mainBody' && node.kind === 'Block'))
  assert.ok(graph.nodes.some((node) => node.id === 'local' && node.kind === 'VariableDeclaration' && node.type?.kind === 'primitive' && node.type?.name === 'int'))
  assert.equal(hasEdge(graph, 'project:debug', 'module:m', 'contains'), true)
  assert.equal(hasEdge(graph, 'module:m', 'main', 'contains'), true)
  assert.equal(hasEdge(graph, 'main', 'mainBody', 'contains'), true)
  assert.equal(hasEdge(graph, 'mainBody', 'local', 'contains'), true)
  assert.equal(hasEdge(graph, 'callee', 'twice', 'references'), true)
  assert.equal(hasEdge(graph, 'callee', 'twice', 'contains'), false)

  const withoutReferences = getAstGraph(project, { includeReferences: false })
  assert.equal(withoutReferences.edges.some((edge) => edge.kind === 'references'), false)
  const limited = getAstGraph(project, { maxNodes: 5 })
  assert.equal(limited.metadata.truncated, true)
  assert.ok(limited.nodes.length <= 5)
  assert.equal(analyzeGraph(graph).acyclic, true)
})

test('graph : DFS, BFS, topologie, SCC, chemins et dépendances transitives', () => {
  const graph = syntheticGraph()
  const dfs = analyzeGraph(graph, { from: 'a', to: 'd', algorithm: 'dfs' })
  assert.equal(dfs.ok, true)
  assert.deepEqual(dfs.traversal.order, ['a', 'b', 'd', 'c'])
  assert.deepEqual(dfs.paths, [['a', 'b', 'd'], ['a', 'c', 'd']])
  assert.deepEqual(dfs.transitiveDependencies.a, ['b', 'c', 'd'])
  assert.deepEqual(dfs.directDependencies, ['b', 'c'])
  assert.equal(dfs.acyclic, true)
  assert.equal(dfs.hasCycles, false)
  assert.equal(dfs.topologicalOrder[0], 'a')
  assert.ok(dfs.topologicalOrder.indexOf('d') > dfs.topologicalOrder.indexOf('b'))
  assert.equal(dfs.summary.componentCount, 4)

  const bfs = analyzeGraph(graph, { from: 'a', to: 'd', algorithm: 'bfs' })
  assert.deepEqual(bfs.traversal.order, ['a', 'b', 'c', 'd'])
  assert.deepEqual(bfs.transitiveDependencies.a, ['b', 'c', 'd'])
  const reverse = analyzeGraph(graph, { from: 'd', direction: 'in', algorithm: 'bfs' })
  assert.deepEqual(reverse.reachableFrom, ['d', 'b', 'c', 'a'])
  assert.deepEqual(reverse.directDependencies, [])
  assert.deepEqual(reverse.reverseDependencies, ['b', 'c'])
  const filtered = analyzeGraph(graph, { from: 'a', edgeKinds: ['missing'] })
  assert.deepEqual(filtered.reachableFrom, ['a'])
  const limited = analyzeGraph(graph, { from: 'a', to: 'd', maxPaths: 1 })
  assert.equal(limited.paths.length, 1)
  assert.equal(limited.pathsTruncated, true)
  assert.deepEqual(analyzeGraph(graph, { from: 'a', allTransitive: true }).transitiveDependencies.d, [])
})

test('graph : cycles, composantes fortement connexes et erreurs d’analyse', () => {
  const graph = cyclicGraph()
  const analysis = analyzeGraph(graph)
  assert.equal(analysis.hasCycles, true)
  assert.equal(analysis.acyclic, false)
  assert.equal(analysis.topologicalOrder, null)
  assert.deepEqual(analysis.cycles, [['a', 'b'], ['c', 'd'], ['e']])
  assert.deepEqual(analysis.stronglyConnectedComponents, [['a', 'b'], ['c', 'd'], ['e']])
  assert.equal(analyzeGraph(graph, { from: 'missing' }).code, GRAPH_ERROR_CODES.nodeNotFound)
  assert.equal(analyzeGraph({ nodes: [], edges: [] }).ok, true)
  assert.equal(analyzeGraph({}).code, GRAPH_ERROR_CODES.invalidGraph)
  assert.equal(analyzeGraph(graph, { algorithm: 'bad' }).code, GRAPH_ERROR_CODES.invalidArgument)
  assert.equal(analyzeGraph(graph, { direction: 'bad' }).code, GRAPH_ERROR_CODES.invalidArgument)
})

test('graph : exports JSON, DOT et Mermaid échappés et déterministes', () => {
  const graph = syntheticGraph()
  const json = exportGraph(graph, 'json')
  assert.deepEqual(JSON.parse(json), graph)
  assert.equal(exportGraph(graph, 'json'), json)
  assert.equal(exportGraph(graph, 'json', { pretty: false }).includes('\n'), false)

  const dot = exportGraph(graph, 'dot', { direction: 'TB', graphName: 'My "Graph"' })
  assert.match(dot, /^digraph "My \\"Graph\\"" \{/)
  assert.match(dot, /rankdir="TB"/)
  assert.match(dot, /"a" -> "b" \[label="calls"\]/)
  assert.equal(dot, exportGraph(graph, 'dot', { direction: 'TB', graphName: 'My "Graph"' }))

  const mermaid = exportGraph(graph, 'mermaid', { direction: 'TD' })
  assert.match(mermaid, /^flowchart TD/)
  assert.match(mermaid, /n0\["A"\]/)
  assert.match(mermaid, /n0 -->\|calls\| n1/)
  assert.equal(mermaid, exportGraph(graph, 'mermaid', { direction: 'TD' }))

  const escaped = {
    ...graph,
    nodes: [
      { id: 'a"b', label: 'Line "one"\nLine \\ two', kind: 'module' },
      { id: 'c', label: '<tag> & | pipe', kind: 'unresolved-call' },
    ],
    edges: [{ id: 'e', from: 'a"b', to: 'c', kind: 'reads|writes' }],
  }
  const escapedDot = exportGraph(escaped, 'dot')
  assert.match(escapedDot, /"a\\"b"/)
  assert.match(escapedDot, /Line \\"one\\"\\nLine \\\\ two/)
  const escapedMermaid = exportGraph(escaped, 'mermaid')
  assert.match(escapedMermaid, /&quot;one&quot;/)
  assert.match(escapedMermaid, /&lt;tag&gt; &amp; \| pipe/)
  assert.match(escapedMermaid, /reads&#124;writes/)

  assert.throws(() => exportGraph(graph, 'svg'), (error) => isGraphError(error) && error.code === GRAPH_ERROR_CODES.unsupportedFormat)
  assert.throws(() => exportGraph({ nodes: [] }, 'dot'), (error) => isGraphError(error) && error.code === GRAPH_ERROR_CODES.invalidGraph)
  assert.match(exportGraph({ nodes: [], edges: [], metadata: {} }, 'mermaid'), /%% empty graph/)
})

test('graph : programmes incomplets, cibles ambiguës et déterminisme', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'callee').references.target = { kind: 'import', importId: 'missing' }
  const dependency = getDependencyGraph(project)
  assert.equal(dependency.ok, true)
  assert.equal(dependency.metadata.incomplete, true)
  assert.ok(dependency.metadata.unresolvedNodeIds.includes('callee'))
  assert.ok(dependency.nodes.some((node) => node.kind === 'unresolved'))
  const calls = getCallGraph(project)
  assert.equal(calls.ok, true)
  assert.equal(calls.metadata.incomplete, true)
  assert.ok(calls.metadata.unresolvedCallNodeIds.includes('call'))
  const ast = getAstGraph(project)
  assert.equal(ast.ok, true)
  assert.equal(ast.metadata.incomplete, true)
  assert.ok(ast.metadata.unresolvedNodeIds.includes('callee'))
  const cfg = getControlFlowGraph(project, 'main')
  assert.equal(cfg.ok, true)
  assert.equal(cfg.metadata.incomplete, true)

  const before = JSON.stringify(project)
  assert.deepEqual(getDependencyGraph(project), dependency)
  assert.deepEqual(getCallGraph(project), calls)
  assert.deepEqual(getAstGraph(project), ast)
  assert.deepEqual(getControlFlowGraph(project, 'main'), cfg)
  assert.equal(JSON.stringify(project), before)

  const ambiguous = debugFixture()
  ambiguous.nodes.push(createNode('m', 'm', 'Literal', { properties: { type: types.int, value: 0 } }))
  assert.equal(getDependencyGraph(ambiguous, { target: 'm' }).code, GRAPH_ERROR_CODES.targetAmbiguous)
  assert.equal(getDependencyGraph(null).code, GRAPH_ERROR_CODES.invalidProject)
})

test('graph : flow graph IDE compatible', () => {
  const project = debugFixture()
  const flow = getFlowGraph(project)
  assert.equal(flow.ok, true)
  assert.equal(flow.kind, 'flow')
  assert.deepEqual(flow.nodes.map((node) => node.name), ['start', 'twice'])
  assert.equal(flow.edges.length, 1)
  assert.equal(flow.edges[0].from, 'main')
  assert.equal(flow.edges[0].to, 'twice')
  assert.ok(flow.metadata.width > 0 && flow.metadata.height > 0)
})
