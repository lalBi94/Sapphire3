const defaultGaps = Object.freeze({ horizontal: 80, vertical: 56 })

// Attribue à chaque module une couche selon ses dépendances : un exportateur précède ses utilisateurs.
export function rankModules(moduleIds, links = []) {
  const incoming = new Map(moduleIds.map((id) => [id, 0]))
  const children = new Map(moduleIds.map((id) => [id, new Set()]))
  for (const link of links) {
    if (!link || link.fromId === link.toId || !incoming.has(link.fromId) || !incoming.has(link.toId)) continue
    const targets = children.get(link.fromId)
    if (targets.has(link.toId)) continue
    targets.add(link.toId)
    incoming.set(link.toId, incoming.get(link.toId) + 1)
  }
  const rank = new Map(moduleIds.map((id) => [id, 0]))
  const queue = moduleIds.filter((id) => incoming.get(id) === 0)
  const visited = new Set()
  while (queue.length > 0) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    for (const next of children.get(id)) {
      rank.set(next, Math.max(rank.get(next), rank.get(id) + 1))
      incoming.set(next, incoming.get(next) - 1)
      if (incoming.get(next) === 0) queue.push(next)
    }
  }
  // Un cycle ne doit pas empiler tous ses modules dans la même colonne.
  let fallback = Math.max(0, ...rank.values()) + 1
  for (const id of moduleIds) if (!visited.has(id)) rank.set(id, fallback++)
  return rank
}

// Répartit des modules en colonnes successives selon leurs dépendances intermodules.
// Les modules exportateurs occupent les premières colonnes, ceux qui les utilisent les suivantes.
export function layoutModules(modules, links = [], gaps = {}) {
  const horizontal = Number.isFinite(gaps.horizontal) ? gaps.horizontal : defaultGaps.horizontal
  const vertical = Number.isFinite(gaps.vertical) ? gaps.vertical : defaultGaps.vertical
  if (modules.length === 0) return {}

  const byId = new Map(modules.map((module) => [module.id, module]))
  const ranks = rankModules([...byId.keys()], links)
  const originX = Math.min(...modules.map((module) => module.x))
  const originY = Math.min(...modules.map((module) => module.y))
  const positions = {}
  let x = originX
  for (const column of [...new Set(ranks.values())].sort((left, right) => left - right)) {
    let y = originY
    let width = 0
    for (const [id, module] of byId) {
      if (ranks.get(id) !== column) continue
      positions[id] = { x, y }
      y += module.height + vertical
      width = Math.max(width, module.width)
    }
    x += width + horizontal
  }
  return positions
}
