// Lit l'état des jauges depuis les variables globales d'une exécution.
export function gaugeGlobalName(kind, index) {
  return `GAUGE_SP3_GLOBAL_${kind}_${index}`
}

// Prépare un lecteur de jauges : les nœuds globaux sont résolus une seule fois.
export function createGaugeStateReader(project) {
  const gauges = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.gauge) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    gauges.push({
      moduleId: module.id,
      valueNodeId: find(gaugeGlobalName('VALUE', module.gauge.index))?.id ?? null,
      minNodeId: find(gaugeGlobalName('MIN', module.gauge.index))?.id ?? null,
      maxNodeId: find(gaugeGlobalName('MAX', module.gauge.index))?.id ?? null,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const gauge of gauges) {
      const value = Number(values.get(gauge.valueNodeId))
      const min = Number(values.get(gauge.minNodeId))
      const max = Number(values.get(gauge.maxNodeId))
      if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) continue
      states[gauge.moduleId] = { value, min, max }
    }
    return states
  }
}

// Lit l'état courant des jauges, sans conserver de Map runtime.
export function readGaugeStates(project, values) {
  return createGaugeStateReader(project)(values)
}