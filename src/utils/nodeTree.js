// Repère ce qui peut se déplier dans l'arbre visuel d'un module ; aucune source logique n'est modifiée.

// Regroupe, par module, les nœuds qui contiennent réellement un autre nœud : les feuilles n'offrent que des slots vides.
export function expandableNodeIdsByModule(index) {
  const idsByModule = new Map()
  for (const node of index.nodes.values()) {
    if (!Object.values(node.children ?? {}).flat().some((id) => typeof id === 'string')) continue
    const ids = idsByModule.get(node.moduleId) ?? []
    ids.push(node.id)
    idsByModule.set(node.moduleId, ids)
  }
  return idsByModule
}

// Rouvre toute la structure en conservant les nœuds déjà dépliés à la main.
export function expandAllNodeIds(expandedNodeIds, expandableIds) {
  return [...new Set([...(expandedNodeIds ?? []), ...expandableIds])]
}

// Un module est « tout déplié » dès que chaque nœud dépliable l'est, les feuilles pouvant rester fermées.
export function isFullyExpanded(expandedNodeIds, expandableIds) {
  if (expandableIds.length === 0) return false
  const expanded = new Set(expandedNodeIds ?? [])
  return expandableIds.every((id) => expanded.has(id))
}

// Décrit la position d'un nœud dans sa liste parente, ou null si rien ne peut être réordonné.
export function siblingOrder(index, id) {
  const parent = index.parents.get(id)?.[0]
  if (!parent) return null
  const list = parent.kind === 'module' ? index.modules.get(parent.id)?.rootNodeIds : index.nodes.get(parent.id)?.children?.[parent.slot]
  if (!Array.isArray(list)) return null
  const position = list.indexOf(id)
  return position === -1 ? null : { position, count: list.length }
}

// Liste les ancêtres d'un nœud, du plus haut au nœud lui-même, sans boucler sur une source invalide.
export function ancestorNodeIds(index, id) {
  const ids = []
  const visited = new Set()
  let cursor = id
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    if (!index.nodes.has(cursor)) break
    ids.unshift(cursor)
    const parent = index.parents.get(cursor)?.[0]
    cursor = parent?.kind === 'node' ? parent.id : null
  }
  return ids
}
