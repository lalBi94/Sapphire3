import { getNodeSchema } from './logic/index.js'
import { kindLabel, nodeSummary } from '../components/LogicTree/logicLabels.js'

// Compare sans casse ni accents : un clavier français tape « func » pour « fonction ».
export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

// Étiquette affichée d'un nœud : son nom libre, sinon son type de construction.
export function nodeDisplayName(node, t) {
  const name = typeof node?.properties?.name === 'string' ? node.properties.name.trim() : ''
  return name || kindLabel(node?.kind ?? '', t)
}

// Chemin logique du nœud, du module jusqu'au parent direct, pour distinguer deux homonymes.
function nodeTrail(nodeId, index, t, moduleName) {
  const parts = [moduleName]
  const visited = new Set([nodeId])
  let cursor = nodeId
  while (cursor) {
    const parent = index.parents.get(cursor)?.find((entry) => entry.kind === 'node')
    if (!parent || visited.has(parent.id)) break
    visited.add(parent.id)
    const parentNode = index.nodes.get(parent.id)
    if (parentNode) parts.unshift(nodeDisplayName(parentNode, t))
    cursor = parent.id
  }
  return parts.join(' › ')
}

// Cherche tous les nœuds dont le nom, la construction ou le résumé contiennent le terme.
export function searchNodes(term, index, t) {
  const needle = normalizeSearchText(term.trim())
  if (!needle || !index?.nodes) return []
  const results = []
  for (const [id, node] of index.nodes) {
    if (!node?.moduleId || !index.modules.has(node.moduleId)) continue
    const module = index.modules.get(node.moduleId)
    const displayName = nodeDisplayName(node, t)
    const kind = kindLabel(node.kind, t)
    const summary = nodeSummary(node, index, getNodeSchema(node.kind), t)
    const haystack = normalizeSearchText(`${displayName} ${kind} ${summary} ${node.kind}`)
    if (!haystack.includes(needle)) continue
    results.push({
      nodeId: id,
      moduleId: node.moduleId,
      moduleName: module.name || module.id,
      name: displayName,
      kindLabel: kind,
      summary,
      trail: nodeTrail(id, index, t, module.name || module.id),
      named: Boolean(node.properties?.name),
    })
  }
  // Les noms saisis d'abord, puis le plus proche du début de mot, puis l'ordre du module.
  return results.sort((left, right) => {
    if (left.named !== right.named) return left.named ? -1 : 1
    const leftIndex = normalizeSearchText(left.name).indexOf(needle)
    const rightIndex = normalizeSearchText(right.name).indexOf(needle)
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    const byName = left.name.localeCompare(right.name)
    if (byName !== 0) return byName
    return left.nodeId.localeCompare(right.nodeId)
  }).slice(0, 100)
}
