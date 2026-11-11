import { createGraph, failureGraph, prepareProject, uniqueId } from './helpers.js'

// Construit la hiérarchie AST, les modules et les références symboliques.
export function getAstGraph(project, options = {}) {
  const prepared = prepareProject(project)
  if (!prepared.ok) return failureGraph('ast', prepared.code, prepared.message, prepared.diagnostics, prepared.cause)
  const { analysis, index } = prepared
  if (!analysis.ast) return failureGraph('ast', 'GRAPH_INVALID_PROJECT', 'The logical AST is unavailable.', analysis.diagnostics ?? [])
  const includeProject = options.includeProject !== false
  const includeModules = options.includeModules !== false
  const includeReferences = options.includeReferences !== false
  const includeImportsExports = options.includeImportsExports !== false
  const includeInvalid = options.includeInvalid !== false
  const includeUnresolved = options.includeUnresolved !== false
  const maxNodes = Number.isSafeInteger(options.maxNodes) && options.maxNodes > 0 ? options.maxNodes : 20000
  const used = new Set()
  const nodes = []
  const edges = []
  const sourceToGraph = new Map()
  const duplicateSourceIds = new Set()
  const unresolvedNodes = new Map()
  const visiting = new WeakSet()
  let truncated = false
  let generated = 0

  const projectId = analysis.ast.sourceId ?? project.id ?? 'project'
  const projectNodeId = includeProject ? uniqueId(`project:${projectId}`, used) : null
  if (projectNodeId) {
    nodes.push({
      id: projectNodeId,
      sourceId: projectId,
      kind: 'project',
      entity: 'project',
      name: projectId,
      label: projectId,
      moduleId: null,
    })
  }

  // Ajoute une arête syntaxique ou symbolique.
  function addEdge(from, to, kind, details = {}) {
    if (!from || !to) return
    edges.push({ from, to, kind, ...details })
  }

  // Parcourt un nœud AST et ses enfants, avec une borne de sécurité.
  function visit(astNode, parentId, slot, position = null, moduleId = null) {
    if (!astNode || typeof astNode !== 'object') return null
    if (!includeInvalid && ['Invalid', 'Hole'].includes(astNode.kind)) return null
    if (nodes.length >= maxNodes) {
      truncated = true
      return null
    }
    if (visiting.has(astNode)) return null
    visiting.add(astNode)
    const sourceId = typeof astNode.sourceId === 'string' && astNode.sourceId.length > 0 ? astNode.sourceId : null
    let id
    if (sourceId && !used.has(sourceId) && !sourceToGraph.has(sourceId)) {
      id = uniqueId(sourceId, used)
    } else {
      if (sourceId && sourceToGraph.has(sourceId)) duplicateSourceIds.add(sourceId)
      id = uniqueId(sourceId ? `${sourceId}::ast` : `ast:${astNode.kind ?? 'node'}:${generated += 1}`, used)
    }
    if (sourceId && !sourceToGraph.has(sourceId)) sourceToGraph.set(sourceId, id)
    nodes.push({
      id,
      sourceId,
      kind: astNode.kind ?? 'Unknown',
      sourceKind: astNode.sourceKind ?? astNode.kind ?? 'Unknown',
      entity: 'ast',
      name: astNode.properties?.name ?? null,
      label: astNode.properties?.name ?? astNode.kind ?? id,
      moduleId: astNode.moduleId ?? moduleId,
      type: sourceId ? index.nodeTypes.get(sourceId) ?? null : null,
      declaredType: astNode.properties?.type ?? null,
      invalid: ['Invalid', 'Hole'].includes(astNode.kind),
    })
    if (parentId) addEdge(parentId, id, 'contains', { slot, ...(position === null ? {} : { index: position }) })
    for (const [childSlot, value] of Object.entries(astNode.children ?? {})) {
      if (Array.isArray(value)) {
        value.forEach((child, index) => visit(child, id, childSlot, index, astNode.moduleId ?? moduleId))
      } else if (value && typeof value === 'object') {
        visit(value, id, childSlot, null, astNode.moduleId ?? moduleId)
      }
    }
    visiting.delete(astNode)
    return id
  }

  const moduleGraphIds = new Map()
  if (includeModules) {
    for (const astModule of analysis.ast.modules ?? []) {
      if (nodes.length >= maxNodes) {
        truncated = true
        break
      }
      const id = uniqueId(`module:${astModule.sourceId}`, used)
      moduleGraphIds.set(astModule.sourceId, id)
      nodes.push({
        id,
        sourceId: astModule.sourceId,
        kind: astModule.moduleKind === 'class' ? 'class' : 'module',
        entity: 'module',
        name: astModule.name ?? astModule.sourceId,
        label: astModule.name ?? astModule.sourceId,
        moduleId: astModule.sourceId,
        moduleName: astModule.name ?? '',
        class: astModule.moduleKind === 'class',
      })
      if (projectNodeId) addEdge(projectNodeId, id, 'contains', { slot: 'modules' })
    }
    for (const astModule of analysis.ast.modules ?? []) {
      const id = moduleGraphIds.get(astModule.sourceId)
      if (!id) continue
      for (const [position, root] of (astModule.body ?? []).entries()) visit(root, id, 'body', position, astModule.sourceId)
      for (const [position, root] of (astModule.detachedNodes ?? []).entries()) visit(root, id, 'detachedNodes', position, astModule.sourceId)
      if (includeImportsExports) {
        for (const entry of astModule.imports ?? []) {
          addEdge(id, moduleGraphIds.get(entry?.moduleId), 'imports', { importId: entry?.id ?? null, nodeId: entry?.nodeId ?? null, localName: entry?.localName ?? null })
        }
        for (const entry of astModule.exports ?? []) {
          addEdge(id, sourceToGraph.get(entry?.nodeId), 'exports', { exportName: entry?.name ?? null })
        }
      }
    }
  } else {
    for (const astModule of analysis.ast.modules ?? []) {
      for (const [position, root] of (astModule.body ?? []).entries()) visit(root, projectNodeId, 'body', position, astModule.sourceId)
    }
  }

  // Ajoute un sommet d'incertitude pour une référence non résolue.
  function unresolvedNode(sourceNodeId, moduleId, reason) {
    const existing = unresolvedNodes.get(sourceNodeId)
    if (existing) return existing
    const id = uniqueId(`unresolved:${sourceNodeId}`, used)
    unresolvedNodes.set(sourceNodeId, id)
    nodes.push({
      id,
      sourceId: sourceNodeId,
      kind: 'unresolved-reference',
      entity: 'unresolved',
      name: reason,
      label: reason,
      moduleId,
      reason,
    })
    return id
  }

  const unresolvedReferenceNodeIds = new Set()
  if (includeReferences) {
    for (const reference of analysis.semantic.references ?? []) {
      const from = sourceToGraph.get(reference.nodeId)
      if (!from) continue
      const symbol = reference.symbolId ? index.symbols.get(reference.symbolId) : null
      const to = symbol?.nodeId ? sourceToGraph.get(symbol.nodeId) : null
      const kind = reference.field === 'properties.type.target' ? 'type' : 'references'
      if (to) {
        addEdge(from, to, kind, {
          field: reference.field ?? null,
          targetSymbolId: symbol?.id ?? null,
          targetKind: symbol?.kind ?? null,
          importedFrom: symbol?.importedFrom ?? null,
        })
      } else {
        unresolvedReferenceNodeIds.add(reference.nodeId)
        if (includeUnresolved) {
          const placeholder = unresolvedNode(reference.nodeId, reference.moduleId, 'reference-unresolved')
          addEdge(from, placeholder, 'references', { field: reference.field ?? null, resolved: false })
        }
      }
    }
  }

  return createGraph({
    kind: 'ast',
    projectId,
    rootId: projectNodeId ?? null,
    rootKind: projectNodeId ? 'project' : null,
    scope: 'project',
    nodes,
    edges,
    metadata: {
      incomplete: !analysis.canGenerate || unresolvedReferenceNodeIds.size > 0 || truncated,
      diagnostics: analysis.diagnostics ?? [],
      unresolvedNodeIds: [...unresolvedReferenceNodeIds].sort(),
      duplicateSourceIds: [...duplicateSourceIds].sort(),
      truncated,
      maxNodes,
      includeProject,
      includeModules,
      includeReferences,
      includeImportsExports,
      includeInvalid,
      includeUnresolved,
    },
  })
}
