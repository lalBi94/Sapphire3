import { buildDependencyGraph, getModuleLinks } from '../../../src/utils/logic/index.js'
import { collectCallSites } from './calls.js'
import { compareIds, createGraph, failureGraph, hasErrors, moduleInfo, prepareProject, resolveGraphTarget, sortById, uniqueId } from './helpers.js'

// Normalise le graphe de dépendances historique d'une cible IDE.
function normalizeScopedDependency(prepared, target, options) {
  const { analysis, index, reachability } = prepared
  const raw = buildDependencyGraph(prepared.project, target, index)
  if (!raw.ok) return failureGraph('dependency', raw.code ?? 'TARGET_INVALID', 'The dependency target cannot be resolved.', raw.diagnostics ?? [])
  const reachable = new Set(reachability?.reachableNodeIds ?? [])
  const nodes = raw.nodes.map((node) => {
    const source = index.nodes.get(node.sourceId)
    const info = moduleInfo(index, source?.moduleId ?? node.moduleId)
    return {
      ...node,
      entity: 'node',
      label: node.name || node.kind || node.id,
      moduleName: info.moduleName,
      type: index.nodeTypes.get(node.sourceId) ?? null,
      reachable: reachable.has(node.sourceId),
    }
  })
  const edges = raw.edges.map((edge) => ({ ...edge, directed: true }))
  return createGraph({
    kind: 'dependency',
    projectId: prepared.project.id,
    rootId: raw.rootId,
    rootKind: raw.rootKind,
    scope: target.kind,
    nodes,
    edges,
    metadata: {
      incomplete: !analysis.canGenerate || raw.unresolvedNodeIds.length > 0,
      diagnostics: analysis.diagnostics ?? [],
      unresolvedNodeIds: raw.unresolvedNodeIds,
      semanticCanGenerate: analysis.canGenerate,
      includeParameters: options.includeParameters !== false,
      includeUnresolved: options.includeUnresolved !== false,
    },
  })
}

// Construit le graphe projet modules + symboles + références + appels.
function buildProjectDependency(prepared, options) {
  const { analysis, index, reachability } = prepared
  const includeParameters = options.includeParameters !== false
  const includeLambdas = options.includeLambdas !== false
  const includeImports = options.includeImports !== false
  const includeExports = options.includeExports !== false
  const includeModuleLinks = options.includeModuleLinks !== false
  const includeCalls = options.includeCalls !== false
  const includeReferences = options.includeReferences !== false
  const includeUnresolved = options.includeUnresolved !== false
  const used = new Set()
  const nodes = new Map()
  const moduleGraphIds = new Map()
  const nodeGraphIds = new Map()
  const unresolvedNodes = new Map()
  const unresolvedReferences = new Set()
  const indirectCallNodeIds = new Set()
  const edges = new Map()
  const reachable = new Set(reachability?.reachableNodeIds ?? [])

  for (const module of prepared.project.modules) {
    const id = uniqueId(`module:${module.id}`, used)
    moduleGraphIds.set(module.id, id)
    nodes.set(id, {
      id,
      sourceId: module.id,
      kind: module.kind === 'class' ? 'class' : 'module',
      entity: 'module',
      name: module.name ?? module.id,
      label: module.name ?? module.id,
      moduleId: module.id,
      moduleName: module.name ?? '',
      class: module.kind === 'class',
      callable: false,
    })
  }

  // Ajoute un symbole déclaré, sans dupliquer les imports.
  function addSymbol(symbol) {
    if (!symbol || symbol.importedFrom || !symbol.nodeId || nodeGraphIds.has(symbol.nodeId)) return
    const source = index.nodes.get(symbol.nodeId)
    if (!source) return
    if (!['FunctionDeclaration', 'VariableDeclaration', 'ConstantDeclaration', 'TypeDeclaration', 'Parameter'].includes(source.kind)) return
    if (source.kind === 'Parameter' && !includeParameters) return
    const info = moduleInfo(index, source.moduleId)
    const id = uniqueId(source.id, used)
    nodeGraphIds.set(source.id, id)
    nodes.set(id, {
      id,
      sourceId: source.id,
      kind: source.kind,
      entity: 'symbol',
      name: source.properties?.name ?? source.id,
      label: source.properties?.name ?? source.kind ?? source.id,
      moduleId: source.moduleId,
      moduleName: info.moduleName,
      classId: info.classId,
      className: info.className,
      type: symbol.type ?? index.nodeTypes.get(source.id) ?? null,
      visibility: source.properties?.visibility ?? null,
      entryPoint: source.properties?.entryPoint === true,
      parameter: source.kind === 'Parameter',
      callable: source.kind === 'FunctionDeclaration',
      reachable: reachable.has(source.id),
    })
  }

  for (const symbol of analysis.semantic.symbols ?? []) addSymbol(symbol)

  // Les membres de classe ne sont pas publiés comme symboles de module par la sémantique.
  function addClassMember(classId, name, nodeId, visibility, constructor = false) {
    if (!nodeId || nodeGraphIds.has(nodeId)) return
    const source = index.nodes.get(nodeId)
    if (!source) return
    const info = moduleInfo(index, source.moduleId)
    const id = uniqueId(source.id, used)
    nodeGraphIds.set(source.id, id)
    nodes.set(id, {
      id,
      sourceId: source.id,
      kind: source.kind,
      entity: 'symbol',
      name: source.properties?.name ?? name,
      label: source.properties?.name ?? name,
      moduleId: source.moduleId,
      moduleName: info.moduleName,
      classId,
      className: info.className,
      type: index.nodeTypes.get(source.id) ?? source.properties?.type ?? null,
      visibility,
      isConstructor: constructor,
      entryPoint: false,
      parameter: false,
      callable: source.kind === 'FunctionDeclaration',
      reachable: reachable.has(source.id),
    })
  }
  for (const [classId, members] of index.classMembers ?? new Map()) {
    for (const [name, nodeId] of members.public ?? new Map()) addClassMember(classId, name, nodeId, 'public')
    for (const [name, nodeId] of members.private ?? new Map()) addClassMember(classId, name, nodeId, 'private')
    if (members.constructor) addClassMember(classId, 'constructor', members.constructor, members.constructorVisibility ?? 'public', true)
  }

  if (includeLambdas) {
    for (const node of prepared.project.nodes) {
      if (node.kind !== 'LambdaExpression' || nodeGraphIds.has(node.id)) continue
      const info = moduleInfo(index, node.moduleId)
      const id = uniqueId(node.id, used)
      nodeGraphIds.set(node.id, id)
      nodes.set(id, {
        id,
        sourceId: node.id,
        kind: 'LambdaExpression',
        entity: 'symbol',
        name: '<lambda>',
        label: '<lambda>',
        moduleId: node.moduleId,
        moduleName: info.moduleName,
        classId: info.classId,
        className: info.className,
        type: index.nodeTypes.get(node.id) ?? null,
        visibility: null,
        entryPoint: false,
        parameter: false,
        callable: true,
        reachable: reachable.has(node.id),
      })
    }
  }

  // Crée un sommet d'incertitude stable pour une référence ou un appel non résolu.
  function unresolvedNode(sourceNodeId, moduleId, reason) {
    const existing = unresolvedNodes.get(sourceNodeId)
    if (existing) return existing
    const id = uniqueId(`unresolved:${sourceNodeId}`, used)
    unresolvedNodes.set(sourceNodeId, id)
    const info = moduleInfo(index, moduleId)
    nodes.set(id, {
      id,
      sourceId: sourceNodeId,
      kind: 'unresolved',
      entity: 'unresolved',
      name: reason,
      label: reason,
      moduleId,
      moduleName: info.moduleName,
      reason,
      callable: false,
    })
    return id
  }

  // Agrège les relations de même nature entre deux sommets.
  function addEdge(from, to, kind, details = {}) {
    if (!from || !to || !nodes.has(from) || !nodes.has(to)) return
    const key = `${from}|${to}|${kind}`
    const existing = edges.get(key)
    if (existing) {
      existing.count += 1
      if (details.callNodeId) {
        existing.callNodeIds ??= []
        existing.callNodeIds.push(details.callNodeId)
      }
      if (details.referenceNodeId) {
        existing.referenceNodeIds ??= []
        existing.referenceNodeIds.push(details.referenceNodeId)
      }
      return
    }
    const { callNodeId, referenceNodeId, ...rest } = details
    edges.set(key, {
      from,
      to,
      kind,
      count: 1,
      ...rest,
      ...(callNodeId ? { callNodeIds: [callNodeId] } : {}),
      ...(referenceNodeId ? { referenceNodeIds: [referenceNodeId] } : {}),
    })
  }

  // Contient : module vers racines, fonction vers paramètres.
  for (const module of prepared.project.modules) {
    const moduleId = moduleGraphIds.get(module.id)
    for (const rootId of module.rootNodeIds ?? []) {
      addEdge(moduleId, nodeGraphIds.get(rootId), 'contains')
    }
  }
  for (const node of prepared.project.nodes) {
    if (!['FunctionDeclaration', 'LambdaExpression'].includes(node.kind)) continue
    const functionId = nodeGraphIds.get(node.id)
    for (const parameterId of node.children?.parameters ?? []) {
      addEdge(functionId, nodeGraphIds.get(parameterId), 'contains')
    }
  }

  if (includeExports) {
    for (const module of prepared.project.modules) {
      const moduleId = moduleGraphIds.get(module.id)
      for (const entry of module.exports ?? []) {
        addEdge(moduleId, nodeGraphIds.get(entry?.nodeId), 'exports', { exportName: entry?.name ?? null })
      }
    }
  }

  if (includeImports) {
    for (const module of prepared.project.modules) {
      const consumer = moduleGraphIds.get(module.id)
      for (const entry of module.imports ?? []) {
        const provider = moduleGraphIds.get(entry?.moduleId)
        addEdge(consumer, provider, 'imports', { importId: entry?.id ?? null, nodeId: entry?.nodeId ?? null, localName: entry?.localName ?? null })
        addEdge(consumer, nodeGraphIds.get(entry?.nodeId), 'imports-symbol', { importId: entry?.id ?? null, localName: entry?.localName ?? null })
      }
    }
  }

  const moduleLinks = getModuleLinks(index)
  if (includeModuleLinks) {
    for (const link of moduleLinks) {
      addEdge(moduleGraphIds.get(link.toId), moduleGraphIds.get(link.fromId), 'uses-export', { exports: link.exports, source: 'moduleLinks' })
    }
  }

  if (includeCalls) {
    for (const site of collectCallSites(prepared)) {
      const owner = site.callerNodeId ? nodeGraphIds.get(site.callerNodeId) : moduleGraphIds.get(site.moduleId)
      if (!owner) continue
      if (site.callee.resolution === 'direct' && site.callee.targetNodeId) {
        addEdge(owner, nodeGraphIds.get(site.callee.targetNodeId), 'calls', {
          callNodeId: site.callNodeId,
          callKind: site.callee.callKind,
          importedFrom: site.callee.importedFrom ?? null,
          targetSymbolId: site.callee.targetSymbolId ?? null,
        })
      } else if (site.callee.resolution === 'indirect' && site.callee.targetNodeId) {
        indirectCallNodeIds.add(site.callNodeId)
        addEdge(owner, nodeGraphIds.get(site.callee.targetNodeId), 'calls-indirect', {
          callNodeId: site.callNodeId,
          callKind: site.callee.callKind,
          reason: site.callee.reason ?? null,
          targetType: site.callee.targetType ?? null,
        })
      } else if (includeUnresolved) {
        const placeholder = unresolvedNode(site.callNodeId, site.moduleId, site.callee.reason ?? 'unresolved-call')
        addEdge(owner, placeholder, 'calls-unresolved', { callNodeId: site.callNodeId, reason: site.callee.reason ?? null })
      }
    }
  }

  if (includeReferences) {
    for (const reference of analysis.semantic.references ?? []) {
      const source = index.nodes.get(reference.nodeId)
      if (!source) continue
      const parent = index.parents.get(source.id)?.[0]
      if (parent?.slot === 'callee' && ['CallExpression', 'NewExpression'].includes(index.nodes.get(parent.id)?.kind)) {
        const symbol = reference.symbolId ? index.symbols.get(reference.symbolId) : null
        if (!symbol?.nodeId) unresolvedReferences.add(source.id)
        continue
      }
      const owner = index.contexts.get(source.id)?.functionId
        ? nodeGraphIds.get(index.contexts.get(source.id).functionId)
        : moduleGraphIds.get(source.moduleId)
      if (!owner) continue
      const symbol = reference.symbolId ? index.symbols.get(reference.symbolId) : null
      const target = symbol?.nodeId ? nodeGraphIds.get(symbol.nodeId) : null
      const kind = reference.field === 'properties.type.target'
        ? 'type'
        : parent?.slot === 'target' && index.nodes.get(parent.id)?.kind === 'AssignmentStatement' ? 'writes' : 'reads'
      if (target) {
        addEdge(owner, target, kind, {
          referenceNodeId: source.id,
          field: reference.field ?? null,
          targetSymbolId: symbol?.id ?? null,
          importedFrom: symbol?.importedFrom ?? null,
        })
      } else if (includeUnresolved) {
        const placeholder = unresolvedNode(source.id, source.moduleId, 'reference-unresolved')
        addEdge(owner, placeholder, 'unresolved', { referenceNodeId: source.id, field: reference.field ?? null })
      }
    }
  }

  const entry = prepared.project.nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  const unresolvedNodeIds = [...new Set([...unresolvedNodes.keys(), ...unresolvedReferences])].sort()
  return createGraph({
    kind: 'dependency',
    projectId: prepared.project.id,
    rootId: entry?.id ?? null,
    rootKind: entry ? 'node' : null,
    scope: 'project',
    nodes: sortById([...nodes.values()]),
    edges: [...edges.values()].sort((left, right) => compareIds(`${left.from}|${left.to}|${left.kind}`, `${right.from}|${right.to}|${right.kind}`)),
    metadata: {
      incomplete: !analysis.canGenerate || hasErrors(analysis.diagnostics) || unresolvedNodeIds.length > 0 || indirectCallNodeIds.size > 0,
      diagnostics: analysis.diagnostics ?? [],
      unresolvedNodeIds,
      indirectCallNodeIds: [...indirectCallNodeIds].sort(),
      semanticCanGenerate: analysis.canGenerate,
      moduleLinks,
      entryFunctionId: entry?.id ?? null,
      includeParameters,
      includeLambdas,
      includeImports,
      includeExports,
      includeModuleLinks,
      includeCalls,
      includeReferences,
      includeUnresolved,
    },
  })
}

// Retourne le graphe de dépendances projet, ou le graphe IDE d'une cible.
export function getDependencyGraph(project, options = {}) {
  const prepared = prepareProject(project)
  if (!prepared.ok) return failureGraph('dependency', prepared.code, prepared.message, prepared.diagnostics, prepared.cause)
  const scope = options.scope ?? (options.target !== undefined ? 'target' : 'project')
  if (scope === 'node' || scope === 'module' || scope === 'target') {
    const value = options.target ?? options.id
    const resolved = resolveGraphTarget(prepared.index, value)
    if (!resolved.ok) return failureGraph('dependency', resolved.code, 'The dependency target cannot be resolved.', prepared.analysis.diagnostics ?? [])
    return normalizeScopedDependency(prepared, resolved.target, options)
  }
  return buildProjectDependency(prepared, options)
}
