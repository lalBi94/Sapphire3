// Carte de chaleur d'exécution : compte les passages par nœud et les convertit en intensités.

// Compte le nombre d'exécutions de chaque nœud à partir de la trace ordonnée d'une simulation.
export function executionCounts(trace = []) {
  const counts = new Map()
  for (const id of trace) {
    if (typeof id !== 'string') continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

// Convertit des comptes en niveaux de 0 (jamais exécuté) à 4 (le plus exécuté), sur une échelle logarithmique.
export function heatLevels(counts = new Map()) {
  const values = [...counts.values()]
  const maximum = values.length ? Math.max(...values) : 0
  const levels = new Map()
  for (const [id, count] of counts) {
    if (count <= 0) { levels.set(id, 0); continue }
    if (maximum <= 1) { levels.set(id, 1); continue }
    const ratio = Math.log(1 + count) / Math.log(1 + maximum)
    levels.set(id, ratio <= 0.34 ? 1 : ratio <= 0.67 ? 2 : ratio < 1 ? 3 : 4)
  }
  return levels
}

// Propage à chaque ancêtre le maximum de ses descendants : une boucle ou un bloc reflète son contenu le plus actif.
export function ancestorCounts(counts = new Map(), index) {
  const result = new Map(counts)
  if (!index?.parents) return result
  for (const [id, count] of counts) {
    let cursor = id
    const visited = new Set()
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      const parent = index.parents.get(cursor)?.[0]
      if (!parent || parent.kind !== 'node') break
      result.set(parent.id, Math.max(result.get(parent.id) ?? 0, count))
      cursor = parent.id
    }
  }
  return result
}
