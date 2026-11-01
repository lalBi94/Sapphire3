// Marge autour des modules pour que les courbes et les pointes de flèche restent visibles.
const layerPadding = 96

// Rectangle monde d'une carte module ; les coordonnées suivent la carte, pas le zoom.
function rectOf(card) {
  return { left: card.x, top: card.y, right: card.x + card.width, bottom: card.y + card.height, x: card.x + card.width / 2, y: card.y + card.height / 2 }
}

// Sort du module exportateur et entre dans le module récepteur par la face la plus directe.
function curveOf(from, to) {
  const source = rectOf(from)
  const target = rectOf(to)
  const dx = target.x - source.x
  const dy = target.y - source.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const start = horizontal
    ? { x: dx >= 0 ? source.right : source.left, y: source.y, nx: dx >= 0 ? 1 : -1, ny: 0 }
    : { x: source.x, y: dy >= 0 ? source.bottom : source.top, nx: 0, ny: dy >= 0 ? 1 : -1 }
  const end = horizontal
    ? { x: dx >= 0 ? target.left : target.right, y: target.y, nx: dx >= 0 ? -1 : 1, ny: 0 }
    : { x: target.x, y: dy >= 0 ? target.top : target.bottom, nx: 0, ny: dy >= 0 ? -1 : 1 }
  const pull = Math.min(180, Math.max(48, Math.hypot(end.x - start.x, end.y - start.y) * 0.42))
  const first = { x: start.x + start.nx * pull, y: start.y + start.ny * pull }
  const second = { x: end.x + end.nx * pull, y: end.y + end.ny * pull }
  return {
    d: `M${start.x} ${start.y} C${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`,
    // Milieu d'une cubique en t = 0.5, utilisé pour l'étiquette et l'infobulle.
    x: (start.x + 3 * first.x + 3 * second.x + end.x) / 8,
    y: (start.y + 3 * first.y + 3 * second.y + end.y) / 8,
  }
}

/**
 * Construit la couche graphique des liens intermodules en coordonnées monde.
 * Retourne null sans lien ni carte à afficher, et ignore un lien dont un module n'a pas de carte.
 */
export function buildLinkLayer(cards, links) {
  const boxes = new Map((Array.isArray(cards) ? cards : []).filter((card) => card?.type === 'module').map((card) => [card.id, card]))
  const edges = (Array.isArray(links) ? links : [])
    .filter((link) => boxes.has(link?.fromId) && boxes.has(link?.toId))
    .map((link) => ({ link, ...curveOf(boxes.get(link.fromId), boxes.get(link.toId)) }))
  if (edges.length === 0) return null

  const bounds = edges.reduce((current, { link, x, y }) => {
    const source = boxes.get(link.fromId)
    const target = boxes.get(link.toId)
    return {
      left: Math.min(current.left, source.x, target.x, x),
      top: Math.min(current.top, source.y, target.y, y),
      right: Math.max(current.right, source.x + source.width, target.x + target.width, x),
      bottom: Math.max(current.bottom, source.y + source.height, target.y + target.height, y),
    }
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })

  return {
    left: bounds.left - layerPadding,
    top: bounds.top - layerPadding,
    width: bounds.right - bounds.left + layerPadding * 2,
    height: bounds.bottom - bounds.top + layerPadding * 2,
    edges,
  }
}
