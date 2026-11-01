import { analyzeProgram } from './analysis.js'
import { captureSourceNode } from './nodeTransfer.js'
import { analyzePurity } from './purity.js'
import { createModule } from './model.js'

// Clones les nœuds d'un module et fige leurs références résolues en identifiants stables.
function captureModule(project, moduleId, analysis) {
  const module = (project.modules ?? []).find((entry) => entry.id === moduleId)
  if (!module) return null
  const nodes = (project.nodes ?? []).filter((node) => node.moduleId === moduleId).map((node) => structuredClone(node))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  for (const reference of analysis.semantic.references) {
    const node = byId.get(reference.nodeId)
    if (!node) continue
    const symbol = symbols.get(reference.symbolId)
    if (!symbol) return null
    const target = { kind: 'node', nodeId: symbol.nodeId }
    if (reference.field === 'references.target') node.references.target = target
    if (reference.field === 'properties.type.target') node.properties.type.target = target
  }
  return { version: 1, kind: 'module', name: module.name, rootNodeIds: [...(module.rootNodeIds ?? [])], nodes }
}

// Fige une fonction ou un module pur en un instantané portable, ou signale le refus.
export function captureBookmark(project, target, options = {}) {
  const analysis = options.analysis ?? analyzeProgram(project)
  const purity = analyzePurity(project, target, analysis)
  if (!purity.ok) return { ok: false, code: purity.code }
  if (!purity.pure) return { ok: false, code: 'BOOKMARK_IMPURE', purity }
  if (target?.kind === 'module') {
    const snapshot = captureModule(project, target.id, analysis)
    return snapshot ? { ok: true, bookmark: snapshot } : { ok: false, code: 'BOOKMARK_TARGET_INVALID' }
  }
  const captured = captureSourceNode(project, target?.id, { index: options.index })
  if (!captured.ok) return { ok: false, code: captured.code }
  const root = captured.clipboard.nodes.find((node) => node.id === captured.clipboard.rootId)
  return { ok: true, bookmark: { version: 1, kind: 'function', name: root?.properties?.name ?? '', rootNodeIds: [captured.clipboard.rootId], nodes: captured.clipboard.nodes } }
}

// Décrit brièvement un favori pour l'interface : nom, signature et volumes, sans modifier l'instantané.
export function describeBookmark(bookmark) {
  const nodes = Array.isArray(bookmark?.nodes) ? bookmark.nodes : []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const functions = nodes.filter((node) => node?.kind === 'FunctionDeclaration').length
  if (bookmark?.kind === 'function') {
    const root = byId.get(bookmark.rootNodeIds?.[0])
    const parameters = (root?.children?.parameters ?? []).map((id) => byId.get(id)?.properties?.type).filter(Boolean)
    return { kind: 'function', name: root?.properties?.name ?? bookmark?.name ?? '', parameters, returnType: root?.properties?.type ?? null, nodeCount: nodes.length, functionCount: functions }
  }
  return { kind: 'module', name: bookmark?.name ?? '', parameters: [], returnType: null, nodeCount: nodes.length, functionCount: functions }
}

// Recopie un instantané dans un module neuf ou existant, en remappant identifiants, enfants et références.
export function insertBookmark(project, bookmark, options = {}) {
  const { moduleId, moduleName, ids } = options
  const existingModule = options.existingModule === true
  if (bookmark?.version !== 1 || !Array.isArray(bookmark.nodes) || bookmark.nodes.length === 0) return { ok: false, code: 'BOOKMARK_INVALID' }
  if (typeof moduleId !== 'string' || !moduleId) return { ok: false, code: 'BOOKMARK_INVALID' }
  if (!existingModule && (typeof moduleName !== 'string' || !moduleName)) return { ok: false, code: 'BOOKMARK_INVALID' }
  if (!Array.isArray(ids) || ids.length !== bookmark.nodes.length || new Set(ids).size !== ids.length) return { ok: false, code: 'BOOKMARK_INVALID' }
  const roots = [...new Set(bookmark.rootNodeIds ?? [])]
  if (roots.length === 0 || roots.some((id) => !bookmark.nodes.some((node) => node.id === id))) return { ok: false, code: 'BOOKMARK_INVALID' }
  const target = (project.modules ?? []).find((module) => module.id === moduleId)
  if (existingModule && !target) return { ok: false, code: 'BOOKMARK_INVALID' }
  const remap = new Map(bookmark.nodes.map((node, position) => [node.id, ids[position]]))
  let nodes
  try {
    nodes = bookmark.nodes.map((source) => {
      const node = structuredClone(source)
      node.id = remap.get(source.id)
      node.moduleId = moduleId
      node.children = Object.fromEntries(Object.entries(node.children ?? {}).map(([slot, value]) => [slot, Array.isArray(value) ? value.map((id) => remap.get(id) ?? id) : value == null ? value : remap.get(value) ?? value]))
      for (const relation of [node.references?.target, node.properties?.type?.target]) {
        if (relation?.kind === 'node' && remap.has(relation.nodeId)) relation.nodeId = remap.get(relation.nodeId)
      }
      // Une copie ne reprend jamais le rôle de point d'entrée : l'original le conserve.
      if (node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true) node.properties.entryPoint = false
      return node
    })
  } catch {
    return { ok: false, code: 'BOOKMARK_INVALID' }
  }
  const newRoots = roots.map((id) => remap.get(id))
  // Un module existant garde ses noms : un nom de racine déjà pris reçoit un suffixe libre.
  if (existingModule) {
    const names = new Set((project.nodes ?? []).filter((node) => node.moduleId === moduleId && typeof node.properties?.name === 'string').map((node) => node.properties.name))
    const rootIds = new Set(newRoots)
    for (const node of nodes) {
      if (!rootIds.has(node.id) || typeof node.properties?.name !== 'string') continue
      const base = node.properties.name
      if (!names.has(base)) { names.add(base); continue }
      let suffix = 2
      while (names.has(`${base}${suffix}`)) suffix += 1
      node.properties.name = `${base}${suffix}`
      names.add(node.properties.name)
    }
  }
  let modules
  if (existingModule) {
    modules = (project.modules ?? []).map((module) => module.id === moduleId ? { ...module, rootNodeIds: [...(module.rootNodeIds ?? []), ...newRoots] } : module)
  } else {
    const module = createModule(moduleId, moduleName)
    module.rootNodeIds = newRoots
    modules = [...(project.modules ?? []), module]
  }
  const next = { ...project, modules, nodes: [...(project.nodes ?? []), ...nodes] }
  const analysis = analyzeProgram(next)
  const previous = options.analysis ?? analyzeProgram(project)
  const known = new Set(previous.diagnostics.map((entry) => JSON.stringify([entry.code, entry.location])))
  const invalid = analysis.diagnostics.filter((entry) => entry.severity === 'error' && !known.has(JSON.stringify([entry.code, entry.location])))
  if (invalid.length) return { ok: false, code: 'BOOKMARK_INVALID', diagnostics: invalid }
  return { ok: true, project: next, analysis, moduleId, rootNodeIds: newRoots, existingModule }
}
