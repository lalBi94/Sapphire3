import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment et Image restent hors de la logique.
export const moduleTypes = {
  [moduleKinds.module]: { sourceKind: moduleKinds.module, label: 'Module', labelKey: 'card.module', targetLabelKey: 'canvas.module', actionKey: 'nav.createModule', width: 320, height: 220, renamable: true, hasEmoji: true },
  [moduleKinds.class]: { sourceKind: moduleKinds.class, label: 'Class', labelKey: 'card.class', targetLabelKey: 'canvas.class', actionKey: 'nav.createClass', width: 340, height: 240, renamable: true, hasEmoji: true },
  screen: { label: 'Screen', labelKey: 'card.screen', targetLabelKey: 'canvas.screen', actionKey: 'nav.createScreen', width: 360, height: 300, renamable: true, hasScreen: true },
  gauge: { label: 'Gauge', labelKey: 'card.gauge', targetLabelKey: 'canvas.gauge', actionKey: 'nav.createGauge', width: 380, height: 260, renamable: true, hasGauge: true },
  progress: { label: 'Progress', labelKey: 'card.progress', targetLabelKey: 'canvas.progress', actionKey: 'nav.createProgress', width: 420, height: 150, renamable: true, hasProgress: true },
  barChart: { label: 'Bar chart', labelKey: 'card.barChart', targetLabelKey: 'canvas.barChart', actionKey: 'nav.createBarChart', width: 420, height: 220, renamable: true, hasBarChart: true },
  xyPlot: { label: 'XY plot', labelKey: 'card.xyPlot', targetLabelKey: 'canvas.xyPlot', actionKey: 'nav.createXyPlot', width: 440, height: 320, renamable: true, hasXyPlot: true },
  oscilloscope: { label: 'Oscilloscope', labelKey: 'card.oscilloscope', targetLabelKey: 'canvas.oscilloscope', actionKey: 'nav.createOscilloscope', width: 560, height: 420, renamable: true, hasOscilloscope: true },
  heatmap: { label: 'Heatmap', labelKey: 'card.heatmap', targetLabelKey: 'canvas.heatmap', actionKey: 'nav.createHeatmap', width: 380, height: 280, renamable: true, hasHeatmap: true },
  led: { label: 'LED', labelKey: 'card.led', targetLabelKey: 'canvas.led', actionKey: 'nav.createLed', width: 220, height: 170, renamable: true, hasLed: true },
  rgbLed: { label: 'RGB LED', labelKey: 'card.rgbLed', targetLabelKey: 'canvas.rgbLed', actionKey: 'nav.createRgbLed', width: 240, height: 190, renamable: true, hasRgbLed: true },
  toggleButton: { label: 'Toggle button', labelKey: 'card.toggleButton', targetLabelKey: 'canvas.toggleButton', actionKey: 'nav.createToggleButton', width: 280, height: 190, renamable: true, hasInputButton: true, inputMode: 'toggle' },
  holdButton: { label: 'Hold button', labelKey: 'card.holdButton', targetLabelKey: 'canvas.holdButton', actionKey: 'nav.createHoldButton', width: 280, height: 190, renamable: true, hasInputButton: true, inputMode: 'hold' },
  comment: { label: 'Comment', labelKey: 'card.comment', targetLabelKey: 'canvas.note', actionKey: 'nav.createComment', width: 320, height: 220, renamable: true, hasText: true },
  image: { label: 'Image', labelKey: 'card.image', targetLabelKey: 'canvas.image', actionKey: 'nav.createImage', width: 420, height: 260, renamable: true, hasImage: true },
}

export const minimumModuleSize = { width: 180, height: 120 }

// Sous-catégories pliables des widgets, dans l'ordre d'affichage.
const widgetCardGroups = [
  { id: 'displays', labelKey: 'canvas.createCategory.widgetsDisplays', types: ['screen', 'gauge', 'progress'] },
  { id: 'charts', labelKey: 'canvas.createCategory.widgetsCharts', types: ['barChart', 'xyPlot', 'oscilloscope', 'heatmap'] },
  { id: 'indicators', labelKey: 'canvas.createCategory.widgetsIndicators', types: ['led', 'rgbLed'] },
  { id: 'inputs', labelKey: 'canvas.createCategory.widgetsInputs', types: ['toggleButton', 'holdButton'] },
]

// Catégories stables du menu de création, dans l'ordre d'affichage.
export const cardCategories = [
  { id: 'programming', labelKey: 'canvas.createCategory.programming', types: [moduleKinds.module, moduleKinds.class] },
  { id: 'widgets', labelKey: 'canvas.createCategory.widgets', types: widgetCardGroups.flatMap((group) => group.types), groups: widgetCardGroups },
  { id: 'annotations', labelKey: 'canvas.createCategory.annotations', types: ['comment', 'image'] },
]

// Cartes qui portent un module source ordinaire ou une classe, hors widgets spécialisés.
export const moduleCardTypes = [moduleKinds.module, moduleKinds.class]

// Les cartes adossées à un module sont distinctes des annotations de présentation.
export const logicalCardTypes = Object.keys(moduleTypes).filter((type) => !moduleTypes[type].hasText && !moduleTypes[type].hasImage)

// Vues possibles d'une carte écran : l'écran lui-même, ou le code de son module caché.
export const screenViews = ['screen', 'code']

// Vues possibles d'une carte jauge : l'aperçu de la jauge, ou le code de son module caché.
export const gaugeViews = ['gauge', 'code']

// Vues possibles d'une carte barre de progression : l'aperçu, ou le code de son module caché.
export const progressViews = ['progress', 'code']

// Vues possibles d'un graphique à barres : l'aperçu, ou le code de son module caché.
export const barChartViews = ['barChart', 'code']

// Vues possibles d'un traceur XY : le graphique, ou le code de son module caché.
export const xyPlotViews = ['xyPlot', 'code']

// Vues possibles d'un oscilloscope : l'instrument, ou le code de son module caché.
export const oscilloscopeViews = ['oscilloscope', 'code']

// Vues de la grille fixe et de son module ordinaire.
export const heatmapViews = ['heatmap', 'code']

// Vues possibles d'une carte LED : le voyant, ou le code de son module caché.
export const ledViews = ['led', 'code']

// Vues possibles d'une LED RVB : le voyant coloré, ou le code de son module caché.
export const rgbLedViews = ['rgbLed', 'code']

// Vues possibles d'un bouton d'entrée : le bouton, ou le code de son module caché.
export const inputButtonViews = ['button', 'code']
