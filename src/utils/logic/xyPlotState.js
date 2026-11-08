// Lit les points et les bornes d'un traceur XY depuis les variables globales d'une exécution.
export function xyPlotGlobalName(kind, index) {
  return `XYPLOT_SP3_GLOBAL_${kind}_${index}`
}

// Borne le nombre de points lus, pour garder l'affichage et le debug bornés.
export const maximumXyPlotPoints = 512

// Nombre de points échantillonnés par défaut lors d'un SET_FUNCTION.
export const xyPlotDefaultSamples = 64

// Prépare un lecteur de traceurs : les nœuds globaux sont résolus une seule fois.
export function createXyPlotStateReader(project) {
  const plots = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.xyPlot) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    plots.push({
      moduleId: module.id,
      pointsNodeId: find(xyPlotGlobalName('POINTS', module.xyPlot.index))?.id ?? null,
      countNodeId: find(xyPlotGlobalName('COUNT', module.xyPlot.index))?.id ?? null,
      xMinNodeId: find(xyPlotGlobalName('X_MIN', module.xyPlot.index))?.id ?? null,
      xMaxNodeId: find(xyPlotGlobalName('X_MAX', module.xyPlot.index))?.id ?? null,
      yMinNodeId: find(xyPlotGlobalName('Y_MIN', module.xyPlot.index))?.id ?? null,
      yMaxNodeId: find(xyPlotGlobalName('Y_MAX', module.xyPlot.index))?.id ?? null,
      autoNodeId: find(xyPlotGlobalName('AUTO', module.xyPlot.index))?.id ?? null,
      revisionNodeId: find(xyPlotGlobalName('REVISION', module.xyPlot.index))?.id ?? null,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const plot of plots) {
      const raw = values.get(plot.pointsNodeId)
      if (!Array.isArray(raw)) continue
      const count = Math.min(maximumXyPlotPoints, Math.max(0, Math.trunc(Number(values.get(plot.countNodeId)) || 0)))
      const points = []
      for (let index = 0; index < count; index += 1) {
        const x = Number(raw[index * 2])
        const y = Number(raw[index * 2 + 1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        points.push([x, y])
      }
      let xMin = Number(values.get(plot.xMinNodeId))
      let xMax = Number(values.get(plot.xMaxNodeId))
      let yMin = Number(values.get(plot.yMinNodeId))
      let yMax = Number(values.get(plot.yMaxNodeId))
      if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
        xMin = -10
        xMax = 10
      }
      const auto = Boolean(values.get(plot.autoNodeId))
      if (auto && points.length > 0) {
        const ys = points.map((point) => point[1])
        yMin = Math.min(...ys)
        yMax = Math.max(...ys)
        const span = yMax - yMin
        const padding = span > 0 ? span * 0.1 : Math.max(1, Math.abs(yMax) * 0.1)
        yMin -= padding
        yMax += padding
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) {
        yMin = -10
        yMax = 10
      }
      states[plot.moduleId] = {
        points,
        xMin,
        xMax,
        yMin,
        yMax,
        revision: Math.trunc(Number(values.get(plot.revisionNodeId)) || 0),
      }
    }
    return states
  }
}

// Lit l'état courant des traceurs, sans conserver de Map runtime.
export function readXyPlotStates(project, values) {
  return createXyPlotStateReader(project)(values)
}
