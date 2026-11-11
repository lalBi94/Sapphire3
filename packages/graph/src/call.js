import { buildFlowGraph } from '../../../src/utils/flowGraph.js'
import { collectCallSites, describeCallable } from './calls.js'
import { createGraph, failureGraph, hasErrors, prepareProject, sortById, uniqueId } from './helpers.js'

// Construit le graphe d'appels direct, indirect et non résolu.
export function getCallGraph(project, options = {}) {
  const prepared = prepareProject(project)
  if (!prepared.ok) return failureGraph('call', prepared.code, prepared.message, prepared.diagnostics, prepared.cause)
  const { analysis, index, reachability } = prepared
  const includeModuleLevel = options.includeModuleLevel !== false
  const includeUnresolved = options.includeUnresolved !== false
  const used = new Set()
  const nodes = new Map()
  const moduleEntryIds = new Map()

  for (const node of prepared.project.nodes) {
    if (!['FunctionDeclaration', 'LambdaExpression'].includes(node.kind)) continue
    const callable = describeCallable(index, node, reachability)
    callable.id = uniqueId(callable.id, used)
    nodes.set(callable.id, callable)
  }

  // Crée un sommet de module pour les appels hors fonction.
  function moduleEntry(moduleId) {
    if (moduleEntryIds.has(moduleId)) return moduleEntryIds.get(moduleId)
    const module = index.modules.get(moduleId)
    const id = uniqueId(`module:${moduleId}`, used)
    moduleEntryIds.set(moduleId, id)
    nodes.set(id, {
      id,
      sourceId: moduleId,
      kind: 'module-entry',
      entity: 'module-entry',
      name: module?.name ?? moduleId,
      label: module?.name ?? moduleId,
      moduleId,
      moduleName: module?.name ?? '',
      callable: false,
      moduleLevel: true,
      reachable: true,
    })
    return id
  }

  const sites = collectCallSites(prepared)
  const direct = new Map()
  const unresolvedCallNodeIds = []
  const indirectCallNodeIds = []
  const omittedCallNodeIds = []
  let moduleLevelCallCount = 0

  // Agrège les appels directs entre les mêmes sommets.
  function addDirect(from, to, site) {
    const key = `${from}|${to}|calls`
    const edge = direct.get(key) ?? { from, to, kind: 'calls', count: 0, callNodeIds: [], callKinds: [] }
    edge.count += 1
    edge.callNodeIds.push(site.callNodeId)
    edge.callKinds.push(site.callee.callKind)
    if (site.callee.importedFrom) edge.importedFrom = site.callee.importedFrom
    if (site.callee.targetSymbolId) edge.targetSymbolId = site.callee.targetSymbolId
    direct.set(key, edge)
  }

  for (const site of sites) {
    if (site.moduleLevel) moduleLevelCallCount += 1
    const callerId = site.callerNodeId && nodes.has(site.callerNodeId)
      ? site.callerNodeId
      : includeModuleLevel ? moduleEntry(site.moduleId) : null
    if (!callerId) {
      omittedCallNodeIds.push(site.callNodeId)
      continue
    }
    if (site.callee.resolution === 'direct' && site.callee.targetNodeId && nodes.has(site.callee.targetNodeId)) {
      addDirect(callerId, site.callee.targetNodeId, site)
      continue
    }
    if (site.callee.resolution === 'indirect') indirectCallNodeIds.push(site.callNodeId)
    else unresolvedCallNodeIds.push(site.callNodeId)
    if (!includeUnresolved) continue
    const placeholderId = uniqueId(`unresolved:${site.callNodeId}`, used)
    nodes.set(placeholderId, {
      id: placeholderId,
      sourceId: site.callNodeId,
      kind: 'unresolved-call',
      entity: 'unresolved-call',
      name: site.callee.reason ?? 'unresolved call',
      label: site.callee.reason ?? 'unresolved call',
      moduleId: site.moduleId,
      moduleName: index.modules.get(site.moduleId)?.name ?? '',
      callable: false,
      resolution: site.callee.resolution,
      reason: site.callee.reason ?? null,
      targetNodeId: site.callee.targetNodeId ?? null,
      targetSymbolId: site.callee.targetSymbolId ?? null,
      targetType: site.callee.targetType ?? null,
      callNodeId: site.callNodeId,
    })
    direct.set(`${callerId}|${placeholderId}|${site.callee.resolution === 'indirect' ? 'calls-indirect' : 'calls-unresolved'}`, {
      from: callerId,
      to: placeholderId,
      kind: site.callee.resolution === 'indirect' ? 'calls-indirect' : 'calls-unresolved',
      count: 1,
      callNodeIds: [site.callNodeId],
      callKinds: [site.callee.callKind],
      resolution: site.callee.resolution,
      reason: site.callee.reason ?? null,
    })
  }

  const reachableIds = (reachability?.functions ?? []).filter((entry) => entry.reachable).map((entry) => entry.nodeId)
  const entry = prepared.project.nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  const callableNodes = [...nodes.values()].filter((node) => node.callable)
  const roots = [entry?.id, ...moduleEntryIds.values()].filter((id) => id && nodes.has(id))
  const rootsToUse = roots.length > 0 ? roots : callableNodes.map((node) => node.id)
  const reachableGraphNodes = new Set(rootsToUse)
  const pending = [...rootsToUse]
  const adjacency = new Map()
  for (const edge of direct.values()) {
    if (edge.kind !== 'calls') continue
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
    adjacency.get(edge.from).push(edge.to)
  }
  while (pending.length > 0) {
    const id = pending.pop()
    for (const target of adjacency.get(id) ?? []) {
      if (reachableGraphNodes.has(target) || !nodes.has(target)) continue
      reachableGraphNodes.add(target)
      pending.push(target)
    }
  }
  for (const node of nodes.values()) {
    if (node.callable || node.kind === 'module-entry') node.reachable = reachableGraphNodes.has(node.id)
    else if (node.kind === 'unresolved-call') node.reachable = reachableGraphNodes.has(node.id)
  }
  const graphReachableIds = callableNodes.filter((node) => node.reachable).map((node) => node.sourceId).sort()
  const graphUnreachableIds = callableNodes.filter((node) => !node.reachable).map((node) => node.sourceId).sort()
  const graph = createGraph({
    kind: 'call',
    projectId: prepared.project.id,
    rootId: entry?.id ?? null,
    rootKind: entry ? 'node' : null,
    scope: 'project',
    nodes: sortById([...nodes.values()]),
    edges: [...direct.values()],
    metadata: {
      incomplete: !analysis.canGenerate || hasErrors(analysis.diagnostics) || unresolvedCallNodeIds.length > 0 || indirectCallNodeIds.length > 0,
      diagnostics: analysis.diagnostics ?? [],
      unresolvedNodeIds: [...unresolvedCallNodeIds, ...indirectCallNodeIds],
      entryFunctionId: entry?.id ?? null,
      reachableFunctionIds: graphReachableIds,
      unreachableFunctionIds: graphUnreachableIds,
      semanticReachableFunctionIds: reachableIds,
      unresolvedCallNodeIds: [...new Set(unresolvedCallNodeIds)].sort(),
      indirectCallNodeIds: [...new Set(indirectCallNodeIds)].sort(),
      moduleLevelCallCount,
      omittedCallNodeIds: [...new Set(omittedCallNodeIds)].sort(),
      includeModuleLevel,
      includeUnresolved,
    },
  })
  return graph
}

// Expose le graphe de flux historique de l'IDE sous la structure commune.
export function getFlowGraph(project, options = {}) {
  const prepared = prepareProject(project)
  if (!prepared.ok) return failureGraph('flow', prepared.code, prepared.message, prepared.diagnostics, prepared.cause)
  const flow = buildFlowGraph(prepared.project, prepared.index, prepared.reachability)
  const nodes = flow.nodes.map((node) => ({
    id: node.id,
    sourceId: node.id,
    kind: 'function',
    entity: 'flow-function',
    name: node.name,
    label: node.name,
    moduleId: node.moduleId,
    moduleName: node.moduleName,
    type: node.signature,
    parameters: node.parameters,
    entryPoint: node.entry,
    recursive: node.recursive,
    reachable: true,
    callable: true,
    layout: { x: node.x, y: node.y },
  }))
  const edges = flow.edges.map((edge) => ({
    from: edge.fromId,
    to: edge.toId,
    fromId: edge.fromId,
    toId: edge.toId,
    kind: 'calls',
    count: edge.count,
    layout: { path: edge.path, midX: edge.midX, midY: edge.midY },
  }))
  return createGraph({
    kind: 'flow',
    projectId: prepared.project.id,
    rootId: flow.nodes.find((node) => node.entry)?.id ?? null,
    rootKind: flow.nodes.length > 0 ? 'node' : null,
    scope: 'reachable-flow',
    nodes,
    edges,
    metadata: {
      incomplete: !prepared.analysis.canGenerate || prepared.reachability?.ok === false,
      diagnostics: prepared.analysis.diagnostics ?? [],
      width: flow.width,
      height: flow.height,
      reachableOnly: true,
      options,
    },
  })
}
