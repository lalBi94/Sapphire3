// Mini-carte déterministe des modules et classes visibles, avec leurs dépendances.

import { rankModules } from './moduleLayout.js'
import { getModuleLinks } from './logic/index.js'
import { moduleCardTypes } from './moduleTypes.js'

const boxWidth = 112
const boxHeight = 38
const columnGap = 56
const rowGap = 18
const margin = 10
const maximumModules = 24

// Construit un tracé courbe d'une dépendance, y compris pour un cycle placé dans la même colonne.
function edgePath(from, to) {
  const x1 = from.x + from.width
  const y1 = from.y + from.height / 2
  const x2 = to.x
  const y2 = to.y + to.height / 2
  if (x2 > x1 + 8) {
    const bend = Math.max(18, (x2 - x1) * 0.45)
    return `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`
  }
  const detour = Math.max(x1, x2 + to.width) + 28
  return `M${x1} ${y1} C${detour} ${y1} ${detour} ${y2} ${x2 + to.width} ${y2}`
}

// Place les modules en colonnes selon leurs dépendances et renvoie les boîtes et les flèches.
export function buildDashboardModuleMap(modules = [], links = []) {
  const selected = (Array.isArray(modules) ? modules : [])
    .filter((module) => module && typeof module.id === 'string' && module.id && typeof module.name === 'string')
    .slice(0, maximumModules)
  const ids = new Set(selected.map((module) => module.id))
  const edges = (Array.isArray(links) ? links : [])
    .filter((link) => link && ids.has(link.fromId) && ids.has(link.toId) && link.fromId !== link.toId)
  const ranks = rankModules([...ids], edges)
  const columns = [...new Set(ranks.values())].sort((left, right) => left - right)
  const rows = new Map(columns.map((rank) => [rank, selected.filter((module) => ranks.get(module.id) === rank)]))
  const maximumRows = Math.max(1, ...[...rows.values()].map((row) => row.length))
  const layoutRows = Math.max(2, maximumRows)
  const boxes = []
  columns.forEach((rank, columnIndex) => {
    const column = rows.get(rank) ?? []
    const offset = (layoutRows - column.length) / 2
    column.forEach((module, rowIndex) => {
      boxes.push({
        id: module.id,
        name: module.name,
        kind: module.kind === 'class' ? 'class' : 'module',
        x: margin + columnIndex * (boxWidth + columnGap),
        y: margin + (offset + rowIndex) * (boxHeight + rowGap),
        width: boxWidth,
        height: boxHeight,
      })
    })
  })
  const byId = new Map(boxes.map((box) => [box.id, box]))
  const arrows = edges.map((edge) => {
    const from = byId.get(edge.fromId)
    const to = byId.get(edge.toId)
    if (!from || !to) return null
    return { fromId: edge.fromId, toId: edge.toId, path: edgePath(from, to) }
  }).filter(Boolean)
  const width = margin * 2 + columns.length * boxWidth + Math.max(0, columns.length - 1) * columnGap
  const height = margin * 2 + layoutRows * boxHeight + Math.max(0, layoutRows - 1) * rowGap
  return { boxes, edges: arrows, width, height }
}

// Extrait les cartes Module/Class visibles et leurs dépendances réelles depuis l'index d'analyse.
export function dashboardModuleMapFromCards(cards = [], index = null) {
  const modules = index?.modules ?? new Map()
  const selected = (Array.isArray(cards) ? cards : [])
    .filter((card) => card && !card.hidden && moduleCardTypes.includes(card.type) && modules.has(card.id))
  const ids = new Set(selected.map((card) => card.id))
  const allLinks = getModuleLinks(index)
  const owners = {}
  for (const link of allLinks) {
    if (ids.has(link.fromId) || !ids.has(link.toId) || owners[link.fromId]) continue
    owners[link.fromId] = link.toId
  }
  const map = buildDashboardModuleMap(
    selected.map((card) => {
      const module = modules.get(card.id)
      return { id: card.id, name: card.name || module?.name || '', kind: module?.kind ?? card.type }
    }),
    allLinks.filter((link) => ids.has(link.fromId) && ids.has(link.toId)),
  )
  return { ...map, owners }
}
