// Calcule le cadrage d'une mini-carte : échelle, contenu visible et projection monde <-> pixels.

// Le contenu couvre les modules et la vue courante, pour que le rectangle caméra reste toujours visible.
export function minimapLayout({ modules = [], camera, zoom, viewport = { width: 0, height: 0 }, width, height, padding = 6 }) {
  const factor = zoom > 0 ? zoom : 1
  const halfWidth = (viewport.width || 0) / 2 / factor
  const halfHeight = (viewport.height || 0) / 2 / factor
  const view = { left: camera.x - halfWidth, top: camera.y - halfHeight, right: camera.x + halfWidth, bottom: camera.y + halfHeight }
  const bounds = modules.reduce((current, module) => ({
    left: Math.min(current.left, module.x, view.left),
    top: Math.min(current.top, module.y, view.top),
    right: Math.max(current.right, module.x + module.width, view.right),
    bottom: Math.max(current.bottom, module.y + module.height, view.bottom),
  }), { left: view.left, top: view.top, right: view.right, bottom: view.bottom })
  const worldWidth = Math.max(1, bounds.right - bounds.left)
  const worldHeight = Math.max(1, bounds.bottom - bounds.top)
  const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight)
  const offsetX = (width - worldWidth * scale) / 2
  const offsetY = (height - worldHeight * scale) / 2
  return {
    scale,
    view,
    bounds,
    toPxX: (x) => offsetX + (x - bounds.left) * scale,
    toPxY: (y) => offsetY + (y - bounds.top) * scale,
    toWorldX: (px) => (px - offsetX) / scale + bounds.left,
    toWorldY: (py) => (py - offsetY) / scale + bounds.top,
  }
}
