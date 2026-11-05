// Seuils d'échelle réelle : les instructions restent lisibles au-dessus de 80 %,
// les fonctions seules entre 45 et 80 %, puis seules les relations entre modules.
export const semanticZoomThresholds = Object.freeze({ modules: 0.45, detail: 0.8 })

// Niveau de zoom minimal qui rend les instructions visibles.
export const semanticDetailZoomLevel = Math.log2(semanticZoomThresholds.detail)

// Retourne le niveau sémantique correspondant à une échelle de canvas.
export function semanticZoomLevel(zoom) {
  if (!Number.isFinite(zoom)) return 'detail'
  if (zoom <= semanticZoomThresholds.modules) return 'modules'
  if (zoom < semanticZoomThresholds.detail) return 'functions'
  return 'detail'
}
