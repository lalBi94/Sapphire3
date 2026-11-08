// Extraction pure des widgets graphiques et de leurs états initiaux, sans exécuter le programme.

import { ledGlobalName } from './logic/ledState.js'
import { rgbLedGlobalName } from './logic/rgbLedState.js'
import { barChartGlobalName } from './logic/barChartState.js'
import { heatmapGlobalName } from './logic/heatmapState.js'

export const dashboardWidgetTypes = Object.freeze(['screen', 'led', 'rgbLed', 'gauge', 'progress', 'barChart', 'xyPlot', 'oscilloscope', 'heatmap'])

// Retrouve la déclaration globale interne à un widget.
function globalDeclaration(project, moduleId, name) {
  return (project.nodes ?? []).find((node) => node?.moduleId === moduleId && node.properties?.name === name) ?? null
}

// Lit un littéral initial sans exécuter le programme.
function initialLiteral(project, moduleId, name) {
  const declaration = globalDeclaration(project, moduleId, name)
  const initializer = declaration?.children?.initializer
  if (!initializer) return null
  const node = (project.nodes ?? []).find((entry) => entry.id === initializer)
  return node?.kind === 'Literal' ? node.properties?.value : null
}

// Lit le nombre de barres depuis le tableau initial, avec la taille historique en secours.
function barChartSize(project, moduleId, index) {
  const declaration = globalDeclaration(project, moduleId, barChartGlobalName('DATA', index))
  const initializer = declaration?.children?.initializer
  const node = (project.nodes ?? []).find((entry) => entry.id === initializer)
  const count = node?.children?.elements?.length
  return Number.isInteger(count) && count > 0 ? count : 12
}

// Construit la liste ordonnée des widgets visibles, avec leurs options d'affichage.
export function dashboardWidgets(project, cards) {
  const modules = new Map((project?.modules ?? []).map((module) => [module.id, module]))
  return (cards ?? [])
    .filter((card) => card && !card.hidden && dashboardWidgetTypes.includes(card.type))
    .filter((card) => modules.has(card.id))
    .sort((left, right) => (left.y ?? 0) - (right.y ?? 0) || (left.x ?? 0) - (right.x ?? 0) || String(left.name).localeCompare(String(right.name)))
    .map((card) => {
      const module = modules.get(card.id)
      const base = { id: card.id, type: card.type, name: card.name || module.name || card.type }
      if (card.type === 'screen') {
        return { ...base, width: module.screen?.width ?? 15, height: module.screen?.height ?? 9 }
      }
      if (card.type === 'gauge') {
        return { ...base, min: module.gauge?.min ?? 0, max: module.gauge?.max ?? 100 }
      }
      if (card.type === 'progress') {
        return { ...base, min: module.progress?.min ?? 0, max: module.progress?.max ?? 100 }
      }
      if (card.type === 'led') {
        return { ...base, value: String(initialLiteral(project, module.id, ledGlobalName(module.led?.index)) ?? 'false') === 'true' }
      }
      if (card.type === 'rgbLed') {
        const channel = (name) => {
          const value = Number(initialLiteral(project, module.id, rgbLedGlobalName(name, module.rgbLed?.index)))
          return Number.isInteger(value) ? Math.min(255, Math.max(0, value)) : 0
        }
        return { ...base, red: channel('RED'), green: channel('GREEN'), blue: channel('BLUE') }
      }
      if (card.type === 'barChart') {
        return { ...base, size: barChartSize(project, module.id, module.barChart?.index) }
      }
      if (card.type === 'xyPlot') {
        return { ...base }
      }
      if (card.type === 'oscilloscope') {
        return { ...base, samples: module.oscilloscope?.samples ?? 64 }
      }
      return { ...base, width: module.heatmap?.width ?? 12, height: module.heatmap?.height ?? 8 }
    })
}

// Produit les états affichés avant le premier Run, sans simulation ni effet de bord.
export function dashboardInitialStates(widgets) {
  const states = { screens: {}, gauges: {}, leds: {}, rgbLeds: {}, progresses: {}, barCharts: {}, xyPlots: {}, oscilloscopes: {}, heatmaps: {} }
  for (const widget of widgets ?? []) {
    if (widget.type === 'screen') {
      states.screens[widget.id] = { width: widget.width, height: widget.height, pixels: new Array(widget.width * widget.height * 4).fill(0) }
    } else if (widget.type === 'gauge') {
      states.gauges[widget.id] = { value: widget.min, min: widget.min, max: widget.max }
    } else if (widget.type === 'progress') {
      states.progresses[widget.id] = { value: widget.min, min: widget.min, max: widget.max }
    } else if (widget.type === 'led') {
      states.leds[widget.id] = { value: Boolean(widget.value) }
    } else if (widget.type === 'rgbLed') {
      states.rgbLeds[widget.id] = { red: widget.red, green: widget.green, blue: widget.blue }
    } else if (widget.type === 'barChart') {
      states.barCharts[widget.id] = { values: new Array(widget.size).fill(0) }
    } else if (widget.type === 'xyPlot') {
      states.xyPlots[widget.id] = { points: [], xMin: -10, xMax: 10, yMin: -10, yMax: 10, revision: 0 }
    } else if (widget.type === 'oscilloscope') {
      states.oscilloscopes[widget.id] = { xMin: -10, xMax: 10, samples: widget.samples, revision: 0, channels: [] }
    } else if (widget.type === 'heatmap') {
      states.heatmaps[widget.id] = { width: widget.width, height: widget.height, values: new Array(widget.width * widget.height).fill(0) }
    }
  }
  return states
}
