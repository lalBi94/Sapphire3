import { analyzeProgram } from './analysis.js'

// Nœuds d'un sous-arbre syntaxique, en suivant uniquement les enfants directs.
function subtreeIds(nodes, rootId) {
  const ids = new Set()
  const pending = [rootId]
  while (pending.length) {
    const id = pending.pop()
    if (ids.has(id)) continue
    const node = nodes.get(id)
    if (!node) continue
    ids.add(id)
    for (const value of Object.values(node.children ?? {})) {
      for (const child of Array.isArray(value) ? value : value == null ? [] : [value]) {
        if (typeof child === 'string') pending.push(child)
      }
    }
  }
  return ids
}

// Nœuds dont un module est propriétaire, détachés compris.
function moduleIds(nodes, moduleId) {
  const ids = new Set()
  for (const [id, node] of nodes) {
    if (node.moduleId === moduleId) ids.add(id)
  }
  return ids
}

// Décide si une fonction ou un module est pur : aucune référence vers un nœud
// extérieur à sa portée et aucun effet de bord (affichage) à l'intérieur.
export function analyzePurity(project, target, analysis = analyzeProgram(project)) {
  const nodes = new Map((project.nodes ?? []).map((node) => [node.id, node]))
  const ids = target?.kind === 'module' ? moduleIds(nodes, target.id) : subtreeIds(nodes, target?.id)
  if (ids.size === 0) return { ok: false, code: 'PURITY_TARGET_INVALID' }
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const external = new Set()
  const unresolved = new Set()
  for (const reference of analysis.semantic.references) {
    if (!ids.has(reference.nodeId)) continue
    const symbol = symbols.get(reference.symbolId)
    if (!symbol) {
      unresolved.add(reference.nodeId)
      continue
    }
    if (!ids.has(symbol.nodeId)) external.add(symbol.nodeId)
  }
  const sideEffects = []
  for (const id of ids) {
    if (nodes.get(id)?.kind === 'PrintStatement') sideEffects.push(id)
  }
  return {
    ok: true,
    pure: external.size === 0 && sideEffects.length === 0 && unresolved.size === 0,
    externalNodeIds: [...external],
    sideEffectNodeIds: sideEffects,
    unresolvedNodeIds: [...unresolved],
  }
}

// Repère en une passe les fonctions et les modules purs, pour les pastilles de l'interface.
export function getPureIds(project, analysis = analyzeProgram(project)) {
  const functions = new Set()
  const modules = new Set()
  for (const node of project.nodes ?? []) {
    if (node.kind !== 'FunctionDeclaration') continue
    if (analyzePurity(project, { kind: 'node', id: node.id }, analysis).pure) functions.add(node.id)
  }
  for (const module of project.modules ?? []) {
    if (analyzePurity(project, { kind: 'module', id: module.id }, analysis).pure) modules.add(module.id)
  }
  return { functions, modules }
}
