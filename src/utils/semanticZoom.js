// Seuils d'échelle réelle : les instructions restent lisibles au-dessus de 21 %,
// les fonctions seules de 10 à 21 %, puis seules les relations entre modules à 10 % et moins.
export const semanticZoomThresholds = Object.freeze({ modules: 0.1, detail: 0.21 })

// Niveau de zoom minimal qui rend les instructions visibles.
export const semanticDetailZoomLevel = Math.log2(semanticZoomThresholds.detail)

// Niveau confortable utilisé par une recherche pour révéler réellement un bloc.
export const semanticSearchZoomLevel = Math.log2(0.8)

// Retourne le niveau sémantique correspondant à une échelle de canvas.
export function semanticZoomLevel(zoom) {
  if (!Number.isFinite(zoom)) return 'detail'
  if (zoom <= semanticZoomThresholds.modules) return 'modules'
  if (zoom <= semanticZoomThresholds.detail) return 'functions'
  return 'detail'
}
