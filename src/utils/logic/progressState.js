// Lit l'état des barres de progression depuis les variables globales d'une exécution.
export function progressGlobalName(kind, index) {
  return `PROGRESS_SP3_GLOBAL_${kind}_${index}`
}

// Prépare un lecteur de barres : les nœuds globaux sont résolus une seule fois.
export function createProgressStateReader(project) {
  const bars = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.progress) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    bars.push({
      moduleId: module.id,
      valueNodeId: find(progressGlobalName('VALUE', module.progress.index))?.id ?? null,
      minNodeId: find(progressGlobalName('MIN', module.progress.index))?.id ?? null,
      maxNodeId: find(progressGlobalName('MAX', module.progress.index))?.id ?? null,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const bar of bars) {
      const value = Number(values.get(bar.valueNodeId))
      const min = Number(values.get(bar.minNodeId))
      const max = Number(values.get(bar.maxNodeId))
      if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) continue
      states[bar.moduleId] = { value, min, max }
    }
    return states
  }
}

// Lit l'état courant des barres, sans conserver de Map runtime.
export function readProgressStates(project, values) {
  return createProgressStateReader(project)(values)
}
