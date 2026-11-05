export const heatmapDefaults = Object.freeze({ width: 12, height: 8 })
export const heatmapMaximumDimension = 32

// Produit le nom stable du tableau de cellules interne à une carte thermique.
export function heatmapGlobalName(index) {
  return `HEATMAP_SP3_GLOBAL_DATA_${index}`
}

// Prépare une lecture indépendante du rendu, sans conserver le tableau mutable du runtime.
export function createHeatmapStateReader(project) {
  const maps = (project?.modules ?? []).filter((module) => module?.heatmap).map((module) => ({
    id: module.id,
    ...module.heatmap,
    dataId: project.nodes.find((node) => node.moduleId === module.id && node.properties?.name === heatmapGlobalName(module.heatmap.index))?.id,
  }))
  return (values) => {
    const states = {}
    if (!(values instanceof Map)) return states
    for (const map of maps) {
      const data = values.get(map.dataId)
      if (!Array.isArray(data) || data.length !== map.width * map.height || data.some((value) => !['number', 'bigint'].includes(typeof value))) continue
      const cells = data.map(Number)
      if (cells.some((value) => !Number.isFinite(value))) continue
      states[map.id] = { width: map.width, height: map.height, values: cells }
    }
    return states
  }
}

// Lit un instantané des cellules au curseur du débogueur.
export function readHeatmapStates(project, values) {
  return createHeatmapStateReader(project)(values)
}
