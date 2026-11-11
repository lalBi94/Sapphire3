// État d'exécution du dashboard exporté et sélecteurs purs, partagés avec le client autonome.

import { clampSimulationSpeed } from './simulationSpeed.js'

export const dashboardExecutionInitial = Object.freeze({
  status: 'idle',
  index: 0,
  result: null,
  error: null,
})

// Cadence d'animation du dashboard : base bornée à environ 8 s, multipliée par la vitesse choisie.
export function dashboardPlaybackRate(totalSteps, speed = 1) {
  const total = Number.isSafeInteger(totalSteps) && totalSteps > 0 ? totalSteps : 0
  return Math.max(60, total / 8) * clampSimulationSpeed(speed)
}

// Calcule le pas suivant, avec un retour au début quand la lecture est autonome.
export function dashboardNextIndex(totalSteps, index, advance, autonomous = false) {
  const total = Number.isSafeInteger(totalSteps) && totalSteps > 0 ? totalSteps : 0
  if (total === 0) return 0
  const next = Math.max(0, Number(index) || 0) + Math.max(1, Number(advance) || 1)
  return autonomous ? next % total : Math.min(total - 1, next)
}

// Réduit les commandes Run/Pause/Stop et l'avancement de la trace.
export function dashboardExecutionReducer(state, action) {
  if (action.type === 'start') {
    return { ...state, ...dashboardExecutionInitial, status: 'preparing' }
  }
  if (action.type === 'prepared') {
    const result = action.result ?? null
    if (!result || result.ok === false) {
      return {
        ...state,
        status: 'error',
        index: 0,
        result,
        error: result?.errorCode ?? action.errorCode ?? 'SIMULATION_FAILED',
      }
    }
    return {
      ...state,
      status: state.status === 'paused' ? 'paused' : 'running',
      index: 0,
      result,
      error: null,
    }
  }
  if (action.type === 'pause') {
    if (state.status !== 'running' && state.status !== 'preparing') return state
    return { ...state, status: 'paused' }
  }
  if (action.type === 'resume') {
    if (state.status !== 'paused') return state
    return { ...state, status: state.result ? 'running' : 'preparing' }
  }
  if (action.type === 'tick') {
    if (state.status !== 'running' || !state.result) return state
    const total = Array.isArray(state.result.trace) ? state.result.trace.length : 0
    const last = Math.max(0, total - 1)
    const index = Math.min(last, state.index + Math.max(1, action.advance ?? 1))
    return { ...state, index, status: index >= last ? 'completed' : 'running' }
  }
  if (action.type === 'seek') {
    if (!state.result) return state
    const total = Array.isArray(state.result.trace) ? state.result.trace.length : 0
    if (total === 0) return state
    const requested = Number(action.index)
    const index = Number.isFinite(requested)
      ? Math.max(0, Math.min(total - 1, Math.trunc(requested)))
      : state.index
    return { ...state, status: 'paused', index }
  }
  if (action.type === 'fail') {
    return { ...state, status: 'error', index: 0, result: action.result ?? null, error: action.errorCode ?? 'SIMULATION_FAILED' }
  }
  if (action.type === 'stop') {
    return { ...state, ...dashboardExecutionInitial }
  }
  return state
}

// Lit une image de widget au pas courant, ou l'état initial si la trace n'a pas encore avancé.
function frameAtIndex(frames, index, fallback) {
  if (!Array.isArray(frames) || frames.length === 0) return fallback
  return frames[Math.max(0, Math.min(frames.length - 1, index))]
}

// Répartit les images d'écran sur la durée de la trace, car elles ne suivent pas chaque pas.
function screenFrameAt(frames, index, traceLength, fallback) {
  if (!Array.isArray(frames) || frames.length === 0) return fallback
  if (traceLength <= 1) return frames[frames.length - 1]
  const position = Math.round((index / (traceLength - 1)) * (frames.length - 1))
  return frames[Math.max(0, Math.min(frames.length - 1, position))]
}

// Sélectionne les états des sept familles de widgets au pas affiché.
export function dashboardStatesAt(result, index, initial = {}) {
  const fallback = {
    screens: initial.screens ?? {},
    gauges: initial.gauges ?? {},
    leds: initial.leds ?? {},
    rgbLeds: initial.rgbLeds ?? {},
    progresses: initial.progresses ?? {},
    barCharts: initial.barCharts ?? {},
    xyPlots: initial.xyPlots ?? {},
    oscilloscopes: initial.oscilloscopes ?? {},
    heatmaps: initial.heatmaps ?? {},
    variables: initial.variables ?? {},
  }
  if (!result) return fallback
  const traceLength = Array.isArray(result.trace) ? result.trace.length : 0
  const last = Math.max(0, traceLength - 1)
  const atEnd = index >= last
  const frames = {
    gauges: result.gaugeFrames,
    leds: result.ledFrames,
    rgbLeds: result.rgbLedFrames,
    progresses: result.progressFrames,
    barCharts: result.barChartFrames,
    xyPlots: result.xyPlotFrames,
    oscilloscopes: result.oscilloscopeFrames,
    heatmaps: result.heatmapFrames,
  }
  return {
    screens: atEnd ? result.screens ?? fallback.screens : screenFrameAt(result.screenFrames, index, traceLength, fallback.screens),
    gauges: atEnd ? result.gauges ?? fallback.gauges : frameAtIndex(frames.gauges, index, fallback.gauges),
    leds: atEnd ? result.leds ?? fallback.leds : frameAtIndex(frames.leds, index, fallback.leds),
    rgbLeds: atEnd ? result.rgbLeds ?? fallback.rgbLeds : frameAtIndex(frames.rgbLeds, index, fallback.rgbLeds),
    progresses: atEnd ? result.progresses ?? fallback.progresses : frameAtIndex(frames.progresses, index, fallback.progresses),
    barCharts: atEnd ? result.barCharts ?? fallback.barCharts : frameAtIndex(frames.barCharts, index, fallback.barCharts),
    xyPlots: atEnd ? result.xyPlots ?? fallback.xyPlots : frameAtIndex(frames.xyPlots, index, fallback.xyPlots),
    oscilloscopes: atEnd ? result.oscilloscopes ?? fallback.oscilloscopes : frameAtIndex(frames.oscilloscopes, index, fallback.oscilloscopes),
    heatmaps: atEnd ? result.heatmaps ?? fallback.heatmaps : frameAtIndex(frames.heatmaps, index, fallback.heatmaps),
    variables: frameAtIndex(result.variableFrames, index, atEnd ? result.variables ?? fallback.variables : fallback.variables),
  }
}

// Ne montre que les sorties déjà atteintes par la trace, dans leur ordre réel.
export function dashboardVisibleOutput(result, index) {
  if (!result || !Array.isArray(result.output)) return []
  if (!Array.isArray(result.outputSteps) || result.outputSteps.length === 0) return result.output
  const currentStep = index + 1
  const count = result.outputSteps.filter((step) => step <= currentStep).length
  return result.output.slice(0, count)
}

// Prépare l'annuaire minimal affiché par l'indicateur d'exécution, sans exposer l'AST.
export function dashboardNodeMap(project) {
  const modules = new Map((project?.modules ?? []).map((module) => [module.id, module.name]))
  const nodes = new Map((project?.nodes ?? []).map((node) => [node.id, {
    id: node.id,
    kind: node.kind,
    name: node.properties?.name ?? '',
    moduleId: node.moduleId ?? '',
    module: modules.get(node.moduleId) ?? '',
  }]))
  return nodes
}

// Retrouve le nœud courant et sa position dans la trace.
export function dashboardCurrentNode(result, index, nodes) {
  if (!result || !Array.isArray(result.trace) || result.trace.length === 0) return null
  const position = Math.max(0, Math.min(result.trace.length - 1, index))
  const id = result.trace[position]
  const node = nodes.get(id)
  return {
    id,
    kind: node?.kind ?? '',
    name: node?.name ?? '',
    moduleId: node?.moduleId ?? '',
    module: node?.module ?? '',
    step: position + 1,
    total: result.trace.length,
  }
}
