// Prépare les lignes accessibles d'un graphique à barres, dans l'ordre d'affichage.
export function barChartRows(values) {
  if (!Array.isArray(values)) return []
  return values.map((value, index) => ({ position: index + 1, value }))
}

// Prépare les lignes accessibles d'une carte thermique, ligne par ligne.
export function heatmapRows(values, width) {
  if (!Array.isArray(values) || !Number.isInteger(width) || width <= 0) return []
  return values.map((value, index) => ({
    row: Math.floor(index / width) + 1,
    column: (index % width) + 1,
    value,
  }))
}
