// Lit les valeurs d'un graphique à barres depuis les variables globales d'une exécution.
export function barChartGlobalName(kind, index) {
  return `BARCHART_SP3_GLOBAL_${kind}_${index}`
}

// Borne le nombre de barres lues, pour garder l'affichage et le debug bornés.
export const maximumBarChartBars = 64

// Prépare un lecteur de graphiques : les nœuds globaux sont résolus une seule fois.
export function createBarChartStateReader(project) {
  const charts = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.barChart) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    charts.push({
      moduleId: module.id,
      dataNodeId: find(barChartGlobalName('DATA', module.barChart.index))?.id ?? null,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const chart of charts) {
      const data = values.get(chart.dataNodeId)
      if (!Array.isArray(data)) continue
      const visible = data.slice(0, maximumBarChartBars)
      if (visible.some((value) => !['number', 'bigint'].includes(typeof value))) continue
      const numbers = visible.map(Number)
      if (numbers.some((value) => !Number.isFinite(value))) continue
      states[chart.moduleId] = { values: numbers }
    }
    return states
  }
}

// Lit l'état courant des graphiques, sans conserver de Map runtime.
export function readBarChartStates(project, values) {
  return createBarChartStateReader(project)(values)
}
