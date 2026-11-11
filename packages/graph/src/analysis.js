import { compareIds, edgeEndpoints, isRecord } from './helpers.js'
import { GRAPH_ERROR_CODES } from './errors.js'

// Prépare les listes d'adjacence filtrées par nature d'arête.
function buildAdjacency(graph, edgeKinds) {
  const nodes = new Map()
  for (const node of graph.nodes) if (isRecord(node) && typeof node.id === 'string' && !nodes.has(node.id)) nodes.set(node.id, node)
  const outgoing = new Map([...nodes.keys()].map((id) => [id, new Set()]))
  const incoming = new Map([...nodes.keys()].map((id) => [id, new Set()]))
  let ignoredEdges = 0
  let filteredEdges = 0
  for (const edge of graph.edges) {
    const { from, to } = edgeEndpoints(edge)
    if (!nodes.has(from) || !nodes.has(to)) {
      ignoredEdges += 1
      continue
    }
    if (edgeKinds && !edgeKinds.has(edge.kind)) continue
    filteredEdges += 1
    outgoing.get(from).add(to)
    incoming.get(to).add(from)
  }
  const sortSet = (set) => [...set].sort(compareIds)
  return {
    nodes,
    outgoing: new Map([...outgoing].map(([id, set]) => [id, sortSet(set)])),
    incoming: new Map([...incoming].map(([id, set]) => [id, sortSet(set)])),
    ignoredEdges,
    filteredEdges,
  }
}

// Retourne les voisins selon la direction demandée.
function neighborMap(adjacency, direction) {
  if (direction === 'in') return adjacency.incoming
  if (direction === 'both') {
    return new Map([...adjacency.nodes.keys()].map((id) => [id, [...new Set([...adjacency.outgoing.get(id), ...adjacency.incoming.get(id)])].sort(compareIds)]))
  }
  return adjacency.outgoing
}

// Parcourt le graphe en profondeur avec un ordre déterministe.
function traverseDfs(start, neighbors, maxDepth) {
  const order = []
  const depth = new Map()
  const seen = new Set()
  const stack = [start]
  depth.set(start, 0)
  while (stack.length > 0) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
    const currentDepth = depth.get(id) ?? 0
    if (currentDepth >= maxDepth) continue
    const next = neighbors.get(id) ?? []
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const target = next[index]
      if (seen.has(target)) continue
      if (!depth.has(target)) depth.set(target, currentDepth + 1)
      stack.push(target)
    }
  }
  return { order, depth }
}

// Parcourt le graphe en largeur avec un ordre déterministe.
function traverseBfs(start, neighbors, maxDepth) {
  const order = []
  const depth = new Map([[start, 0]])
  const seen = new Set([start])
  const queue = [start]
  for (let position = 0; position < queue.length; position += 1) {
    const id = queue[position]
    order.push(id)
    const currentDepth = depth.get(id) ?? 0
    if (currentDepth >= maxDepth) continue
    for (const target of neighbors.get(id) ?? []) {
      if (seen.has(target)) continue
      seen.add(target)
      depth.set(target, currentDepth + 1)
      queue.push(target)
    }
  }
  return { order, depth }
}

// Énumère un nombre borné de chemins simples entre deux sommets.
function findPaths(start, end, neighbors, maxDepth, maxPaths) {
  if (start === end) return { paths: [[start]], truncated: false }
  const paths = []
  let truncated = false
  const seen = new Set([start])
  const path = [start]
  function visit(id, depth) {
    if (paths.length >= maxPaths) {
      truncated = true
      return
    }
    if (depth >= maxDepth) return
    for (const target of neighbors.get(id) ?? []) {
      if (seen.has(target)) continue
      seen.add(target)
      path.push(target)
      if (target === end) paths.push([...path])
      else visit(target, depth + 1)
      path.pop()
      seen.delete(target)
      if (paths.length >= maxPaths) {
        truncated = true
        break
      }
    }
  }
  visit(start, 0)
  return { paths, truncated }
}

// Calcule les composantes fortement connexes par Kosaraju itératif.
function stronglyConnectedComponents(nodes, outgoing, incoming) {
  const visited = new Set()
  const finish = []
  for (const start of [...nodes.keys()].sort(compareIds)) {
    if (visited.has(start)) continue
    const stack = [{ id: start, index: 0 }]
    visited.add(start)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const next = outgoing.get(frame.id) ?? []
      if (frame.index < next.length) {
        const target = next[frame.index]
        frame.index += 1
        if (!visited.has(target)) {
          visited.add(target)
          stack.push({ id: target, index: 0 })
        }
      } else {
        finish.push(frame.id)
        stack.pop()
      }
    }
  }
  const assigned = new Set()
  const components = []
  for (let position = finish.length - 1; position >= 0; position -= 1) {
    const start = finish[position]
    if (assigned.has(start)) continue
    const component = []
    const stack = [start]
    assigned.add(start)
    while (stack.length > 0) {
      const id = stack.pop()
      component.push(id)
      for (const target of incoming.get(id) ?? []) {
        if (assigned.has(target)) continue
        assigned.add(target)
        stack.push(target)
      }
    }
    component.sort(compareIds)
    components.push(component)
  }
  components.sort((left, right) => compareIds(left[0], right[0]))
  return components
}

// Calcule un ordre topologique par DFS ; null lorsqu'un cycle existe.
function topologicalOrder(nodes, outgoing) {
  const state = new Map()
  const order = []
  let cyclic = false
  for (const start of [...nodes.keys()].sort(compareIds)) {
    if (state.has(start)) continue
    const stack = [{ id: start, index: 0 }]
    state.set(start, 1)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const next = outgoing.get(frame.id) ?? []
      if (frame.index < next.length) {
        const target = next[frame.index]
        frame.index += 1
        if (state.get(target) === 1) cyclic = true
        else if (!state.has(target)) {
          state.set(target, 1)
          stack.push({ id: target, index: 0 })
        }
      } else {
        state.set(frame.id, 2)
        order.push(frame.id)
        stack.pop()
      }
    }
  }
  return cyclic ? null : order.reverse()
}

// Calcule l'ensemble des dépendances transitives d'un sommet.
function transitive(start, neighbors) {
  const seen = new Set()
  const stack = [...(neighbors.get(start) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    for (const target of neighbors.get(id) ?? []) if (!seen.has(target)) stack.push(target)
  }
  seen.delete(start)
  return [...seen].sort(compareIds)
}

/**
 * Analyse un graphe : parcours, cycles, tri topologique, composantes,
 * chemins et dépendances transitives.
 */
export function analyzeGraph(graph, options = {}) {
  if (!isRecord(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { ok: false, code: GRAPH_ERROR_CODES.invalidGraph, message: 'Expected a graph with nodes and edges arrays.' }
  }
  const direction = options.direction ?? 'out'
  if (!['out', 'in', 'both'].includes(direction)) {
    return { ok: false, code: GRAPH_ERROR_CODES.invalidArgument, message: 'Expected direction out, in or both.' }
  }
  const algorithm = options.algorithm ?? 'dfs'
  if (!['dfs', 'bfs'].includes(algorithm)) {
    return { ok: false, code: GRAPH_ERROR_CODES.invalidArgument, message: 'Expected algorithm dfs or bfs.' }
  }
  const maxDepth = Number.isSafeInteger(options.maxDepth) && options.maxDepth >= 0 ? options.maxDepth : 10000
  const maxPaths = Number.isSafeInteger(options.maxPaths) && options.maxPaths > 0 ? Math.min(options.maxPaths, 1000) : 20
  const edgeKinds = Array.isArray(options.edgeKinds) ? new Set(options.edgeKinds) : null
  const adjacency = buildAdjacency(graph, edgeKinds)
  const nodeIds = [...adjacency.nodes.keys()].sort(compareIds)
  const from = options.from ?? nodeIds[0] ?? null
  const to = options.to ?? null
  if (from !== null && !adjacency.nodes.has(from)) {
    return { ok: false, code: GRAPH_ERROR_CODES.nodeNotFound, message: `Unknown graph node: ${from}.` }
  }
  if (to !== null && !adjacency.nodes.has(to)) {
    return { ok: false, code: GRAPH_ERROR_CODES.nodeNotFound, message: `Unknown graph node: ${to}.` }
  }
  const neighbors = neighborMap(adjacency, direction)
  const traversal = from === null
    ? null
    : algorithm === 'dfs' ? traverseDfs(from, neighbors, maxDepth) : traverseBfs(from, neighbors, maxDepth)
  const paths = from !== null && to !== null ? findPaths(from, to, neighbors, maxDepth, maxPaths) : null
  const components = stronglyConnectedComponents(adjacency.nodes, adjacency.outgoing, adjacency.incoming)
  const selfLoops = new Set([...adjacency.outgoing].filter(([id, targets]) => targets.includes(id)).map(([id]) => id))
  const cycles = components.filter((component) => component.length > 1 || selfLoops.has(component[0]))
  const topo = topologicalOrder(adjacency.nodes, adjacency.outgoing)
  const directDependencies = from !== null ? [...(adjacency.outgoing.get(from) ?? [])] : []
  const reverseDependencies = from !== null ? [...(adjacency.incoming.get(from) ?? [])] : []
  const transitiveDependencies = options.allTransitive === true
    ? Object.fromEntries(nodeIds.map((id) => [id, transitive(id, neighbors)]))
    : from !== null ? { [from]: transitive(from, neighbors) } : null
  return {
    ok: true,
    directed: graph.directed !== false,
    nodeCount: adjacency.nodes.size,
    edgeCount: graph.edges.length,
    filteredEdgeCount: adjacency.filteredEdges,
    ignoredEdgeCount: adjacency.ignoredEdges,
    algorithm,
    direction,
    edgeKinds: edgeKinds ? [...edgeKinds].sort(compareIds) : null,
    from,
    to,
    traversal: traversal ? {
      algorithm,
      from,
      direction,
      maxDepth,
      order: traversal.order,
      depth: Object.fromEntries([...traversal.depth.entries()].sort((left, right) => compareIds(left[0], right[0]))),
    } : null,
    reachableFrom: traversal?.order ?? [],
    directDependencies,
    reverseDependencies,
    transitiveDependencies,
    paths: paths?.paths ?? null,
    pathsTruncated: paths?.truncated ?? false,
    acyclic: cycles.length === 0,
    hasCycles: cycles.length > 0,
    cycles,
    stronglyConnectedComponents: components,
    topologicalOrder: topo,
    incomplete: Boolean(graph.metadata?.incomplete),
    unresolvedNodeIds: Array.isArray(graph.metadata?.unresolvedNodeIds) ? graph.metadata.unresolvedNodeIds : [],
    summary: {
      nodeCount: adjacency.nodes.size,
      edgeCount: graph.edges.length,
      filteredEdgeCount: adjacency.filteredEdges,
      componentCount: components.length,
      cycleCount: cycles.length,
      reachableCount: traversal?.order.length ?? 0,
    },
  }
}
