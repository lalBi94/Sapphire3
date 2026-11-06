export const moduleSnapPixels = 8

// Retourne les trois repères d'un axe : début, milieu et fin.
function axisEdges(start, size) {
  return [start, start + size / 2, start + size]
}

// Cherche le repère le plus proche parmi les candidats pour un axe donné.
function nearestSnap(movingStart, movingSize, candidates, axis, threshold) {
  const movingEdges = axisEdges(movingStart, movingSize)
  const sizeKey = axis === 'x' ? 'width' : 'height'
  let best = null
  for (const candidate of candidates) {
    const candidateEdges = axisEdges(candidate[axis], candidate[sizeKey])
    for (const target of candidateEdges) {
      for (const source of movingEdges) {
        const delta = target - source
        if (Math.abs(delta) > threshold) continue
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, guide: target }
      }
    }
  }
  return best
}

// Aligne un rectangle mobile sur les bords ou centres des rectangles voisins.
export function snapModuleRect(moving, candidates, threshold = moduleSnapPixels) {
  const vertical = nearestSnap(moving.x, moving.width, candidates, 'x', threshold)
  const horizontal = nearestSnap(moving.y, moving.height, candidates, 'y', threshold)
  return {
    x: moving.x + (vertical?.delta ?? 0),
    y: moving.y + (horizontal?.delta ?? 0),
    guides: {
      vertical: vertical ? [vertical.guide] : [],
      horizontal: horizontal ? [horizontal.guide] : [],
    },
  }
}
