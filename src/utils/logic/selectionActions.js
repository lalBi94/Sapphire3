import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
import { deleteSourceModule, deleteSourceNodes } from './sourceMutation.js'
import { captureSourceNode, duplicateSourceNode, moveSourceNode } from './nodeTransfer.js'
import { isId, isRecord } from './model.js'

// Compare deux diagnostics par leur localisation stable, sans dépendre du message traduit.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Reconnaît une cible de sélection utilisable par les opérations groupées.
function validTarget(target) {
  return isRecord(target) && (target.kind === 'node' || target.kind === 'module') && isId(target.id)
}

// Déduplique les cibles en conservant l'ordre demandé.
function uniqueTargets(targets) {
  const seen = new Set()
  return (Array.isArray(targets) ? targets : []).filter((target) => {
    if (!validTarget(target)) return false
    const key = `${target.kind}:${target.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Vérifie si un nœud possède un ancêtre syntaxique déjà sélectionné.
function hasSelectedAncestor(nodeId, selectedIds, parents) {
  let current = parents.get(nodeId)?.[0]
  while (current?.kind === 'node') {
    if (selectedIds.has(current.id)) return true
    current = parents.get(current.id)?.[0]
  }
  return false
}

// Refuse une nouvelle erreur bloquante sans transformer une source invalide existante en succès silencieux.
function newDiagnostics(previous, next) {
  const known = new Set((previous?.diagnostics ?? []).map(diagnosticKey))
  return next.diagnostics.filter((diagnostic) => diagnostic.severity === 'error' && !known.has(diagnosticKey(diagnostic)))
}

// Choisit un nom de module libre en conservant le nom source et un suffixe lisible.
function uniqueModuleName(usedNames, base) {
  const fallback = typeof base === 'string' && base.trim() ? base.trim() : 'Module'
  if (!usedNames.has(fallback)) return fallback
  let suffix = 2
  while (usedNames.has(`${fallback} ${suffix}`)) suffix += 1
  return `${fallback} ${suffix}`
}

// Clone un module entier, ses imports/exports et ses références internes, sous de nouveaux identifiants.
function duplicateModule(project, sourceModuleId, idFactory, index, usedNames) {
  const source = project.modules.find((module) => module?.id === sourceModuleId)
  if (!source) return { ok: false, code: 'TARGET_MISSING' }
  const nodes = project.nodes.filter((node) => node?.moduleId === sourceModuleId)
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length) return { ok: false, code: 'TARGET_AMBIGUOUS' }
  const moduleId = idFactory()
  if (!isId(moduleId) || project.modules.some((module) => module?.id === moduleId)) return { ok: false, code: 'ID_CONFLICT' }
  const nodeIds = new Map(nodes.map((node) => [node.id, idFactory()]))
  const nodeValues = [...nodeIds.values()]
  if (nodeValues.some((id) => !isId(id) || index.nodes.has(id)) || new Set(nodeValues).size !== nodeValues.length) return { ok: false, code: 'ID_CONFLICT' }

  const sourceImports = Array.isArray(source.imports) ? source.imports : []
  if (sourceImports.some((entry) => !isRecord(entry) || !isId(entry.id))) return { ok: false, code: 'DUPLICATE_INVALID' }
  const importIds = new Map(sourceImports.map((entry) => [entry.id, idFactory()]))
  if ([...importIds.values()].some((id) => !isId(id)) || new Set(importIds.values()).size !== importIds.size) return { ok: false, code: 'ID_CONFLICT' }

  const roots = (Array.isArray(source.rootNodeIds) ? source.rootNodeIds : []).map((id) => nodeIds.get(id))
  if (roots.some((id) => !id)) return { ok: false, code: 'DUPLICATE_INVALID' }
  const name = uniqueModuleName(usedNames, source.name)
  usedNames.add(name)

  // Recopie un lien en remappant seulement les cibles internes au module cloné.
  const remapTarget = (target) => {
    if (target?.kind === 'node' && nodeIds.has(target.nodeId)) target.nodeId = nodeIds.get(target.nodeId)
    if (target?.kind === 'import' && importIds.has(target.importId)) target.importId = importIds.get(target.importId)
  }

  // Une classe copiée doit se désigner elle-même, même dans une signature imbriquée.
  function remapClassType(type, depth = 0) {
    if (!isRecord(type) || depth > 20) return
    if (source.kind === 'class' && type.kind === 'class' && type.classId === sourceModuleId) type.classId = moduleId
    if (type.kind === 'function') {
      for (const parameter of Array.isArray(type.parameters) ? type.parameters : []) remapClassType(parameter, depth + 1)
      remapClassType(type.returnType, depth + 1)
    }
  }

  let clonedNodes
  try {
    clonedNodes = nodes.map((sourceNode) => {
      const node = structuredClone(sourceNode)
      node.id = nodeIds.get(sourceNode.id)
      node.moduleId = moduleId
      node.children = Object.fromEntries(Object.entries(node.children ?? {}).map(([slot, value]) => [slot, Array.isArray(value) ? value.map((id) => nodeIds.get(id) ?? id) : value == null ? value : nodeIds.get(value) ?? value]))
      remapTarget(node.references?.target)
      remapTarget(node.properties?.type?.target)
      remapClassType(node.properties?.type)
      if (source.kind === 'class' && node.kind === 'NewExpression' && node.properties?.classId === sourceModuleId) node.properties.classId = moduleId
      if (node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true) node.properties.entryPoint = false
      return node
    })
  } catch {
    return { ok: false, code: 'DUPLICATE_INVALID' }
  }

  const imports = sourceImports.map((entry) => ({ ...entry, id: importIds.get(entry.id) }))
  const exports = (Array.isArray(source.exports) ? source.exports : []).map((entry) => isRecord(entry) && nodeIds.has(entry.nodeId) ? { ...entry, nodeId: nodeIds.get(entry.nodeId) } : entry)
  const module = { ...source, id: moduleId, name, rootNodeIds: roots, imports, exports }
  const candidate = { ...project, modules: [...project.modules, module], nodes: [...project.nodes, ...clonedNodes] }
  const analysis = analyzeProgram(candidate)
  const invalid = newDiagnostics(index.analysis, analysis)
  if (invalid.length) return { ok: false, code: 'DUPLICATE_INVALID', diagnostics: invalid }
  return {
    ok: true,
    project: candidate,
    analysis,
    index: createContextIndex(candidate, analysis),
    duplicatedModule: { sourceModuleId, moduleId, name, nodeIdMap: Object.fromEntries(nodeIds) },
  }
}

// Supprime plusieurs nœuds et modules en une seule source candidate, sans mutation partielle.
export function deleteSourceTargets(project, targets, options = {}) {
  const failure = (code, diagnostics = []) => ({ ok: false, code, project, diagnostics })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  const requested = uniqueTargets(targets)
  if (requested.length === 0) return failure('TARGET_INVALID')
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analyzeProgram(project))
  const moduleIds = requested.filter((target) => target.kind === 'module').map((target) => target.id)
  const nodeIds = requested.filter((target) => target.kind === 'node').map((target) => target.id)
  if (moduleIds.some((id) => !index.modules.has(id))) return failure('TARGET_MISSING')
  if (nodeIds.some((id) => !index.nodes.has(id))) return failure('TARGET_MISSING')
  const selectedModules = new Set(moduleIds)
  const selectedNodes = new Set(nodeIds)
  const roots = nodeIds.filter((id) => !selectedModules.has(index.nodes.get(id)?.moduleId) && !hasSelectedAncestor(id, selectedNodes, index.parents))

  let candidate = project
  let currentIndex = index
  const removedModuleIds = []
  const removedNodeIds = []
  for (const moduleId of moduleIds) {
    const result = deleteSourceModule(candidate, moduleId)
    if (!result.ok) return failure(result.code)
    candidate = result.project
    currentIndex = result.index
    removedModuleIds.push(moduleId)
  }
  for (const nodeId of roots) {
    if (!currentIndex.nodes.has(nodeId)) continue
    const result = deleteSourceNodes(candidate, { kind: 'node', id: nodeId }, { index: currentIndex })
    if (!result.ok) return failure(result.code, result.diagnostics)
    candidate = result.project
    currentIndex = result.index
    removedNodeIds.push(...result.removedNodeIds)
  }
  if (removedModuleIds.length === 0 && removedNodeIds.length === 0) return failure('TARGET_INVALID')
  return { ok: true, project: candidate, analysis: currentIndex.analysis, index: currentIndex, removedModuleIds, removedNodeIds, selection: null }
}

// Duplique plusieurs nœuds et modules ; les descendants déjà couverts par un parent ne sont pas copiés deux fois.
export function duplicateSourceTargets(project, targets, options = {}) {
  const failure = (code, diagnostics = []) => ({ ok: false, code, project, diagnostics })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (typeof options.idFactory !== 'function') return failure('DUPLICATE_INVALID')
  const requested = uniqueTargets(targets)
  if (requested.length === 0) return failure('TARGET_INVALID')
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analyzeProgram(project))
  const moduleIds = requested.filter((target) => target.kind === 'module').map((target) => target.id)
  const nodeIds = requested.filter((target) => target.kind === 'node').map((target) => target.id)
  if (moduleIds.some((id) => !index.modules.has(id)) || nodeIds.some((id) => !index.nodes.has(id))) return failure('TARGET_MISSING')

  let candidate = project
  let currentIndex = index
  const usedNames = new Set(project.modules.map((module) => module.name).filter((name) => typeof name === 'string'))
  const duplicatedModules = []
  const duplicatedNodeIds = []
  for (const moduleId of moduleIds) {
    const result = duplicateModule(candidate, moduleId, options.idFactory, currentIndex, usedNames)
    if (!result.ok) return failure(result.code, result.diagnostics)
    candidate = result.project
    currentIndex = result.index
    duplicatedModules.push(result.duplicatedModule)
  }

  const selectedModules = new Set(moduleIds)
  const selectedNodes = new Set(nodeIds)
  const roots = nodeIds.filter((id) => !selectedModules.has(currentIndex.nodes.get(id)?.moduleId) && !hasSelectedAncestor(id, selectedNodes, index.parents))
  for (const nodeId of roots) {
    if (!currentIndex.nodes.has(nodeId)) continue
    const captured = captureSourceNode(candidate, nodeId, { index: currentIndex })
    if (!captured.ok) return failure(captured.code, captured.diagnostics)
    const ids = captured.clipboard.nodes.map(() => options.idFactory())
    const result = duplicateSourceNode(candidate, nodeId, { ids, index: currentIndex })
    if (!result.ok) return failure(result.code, result.diagnostics)
    const rootPosition = captured.clipboard.nodes.findIndex((node) => node.id === nodeId)
    candidate = result.project
    currentIndex = result.index
    duplicatedNodeIds.push(ids[rootPosition])
  }
  if (duplicatedModules.length === 0 && duplicatedNodeIds.length === 0) return failure('TARGET_INVALID')
  return { ok: true, project: candidate, analysis: currentIndex.analysis, index: currentIndex, duplicatedModules, duplicatedNodeIds }
}

// Déplace plusieurs nœuds vers un même destinataire, en refusant la sélection partiellement couverte.
export function moveSourceNodes(project, nodeIds, receiver, options = {}) {
  const failure = (code, diagnostics = []) => ({ ok: false, code, project, diagnostics })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!Array.isArray(nodeIds) || nodeIds.length === 0 || nodeIds.some((id) => !isId(id))) return failure('TARGET_INVALID')
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analyzeProgram(project))
  const selected = new Set(nodeIds)
  if ([...selected].some((id) => !index.nodes.has(id))) return failure('TARGET_MISSING')
  if (receiver?.kind === 'node' && selected.has(receiver.id)) return failure('TRANSFER_CYCLE')
  const roots = [...selected].filter((id) => !hasSelectedAncestor(id, selected, index.parents))
  if (roots.length === 0) return failure('TARGET_INVALID')

  let candidate = project
  let currentIndex = index
  for (const nodeId of roots) {
    const result = moveSourceNode(candidate, nodeId, receiver, { index: currentIndex })
    if (!result.ok) return failure(result.code, result.diagnostics)
    candidate = result.project
    currentIndex = result.index
  }
  return { ok: true, project: candidate, analysis: currentIndex.analysis, index: currentIndex, movedNodeIds: roots, nodeId: roots[0] }
}
