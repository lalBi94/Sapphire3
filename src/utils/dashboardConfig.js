// Configuration d'export du dashboard web, indépendante de React et du stockage.

import { contractKinds } from './logic/contracts.js'

export const dashboardSimulationBudget = 20000
export const dashboardLayoutStoragePrefix = 'sapphire3-dashboard-layout'
export const dashboardModeStorageKey = 'sapphire3-dashboard-mode'
export const dashboardLanguageStorageKey = 'sapphire3-dashboard-language'
export const dashboardThemeStorageKey = 'sapphire3-dashboard-theme'
export const dashboardOutputPanelId = 'sapphire:dashboard:output'
export const dashboardExecutionPanelId = 'sapphire:dashboard:execution'

// Couleurs réellement utilisées par le dashboard : la palette imposée reste portable dans le workspace.
export const dashboardPaletteTokens = Object.freeze([
  '--color-black',
  '--color-anthracite',
  '--color-anthracite-raised',
  '--color-input',
  '--color-text',
  '--color-text-muted',
  '--color-border',
  '--color-border-hover',
  '--color-hover',
  '--color-grid',
  '--color-canvas-edge',
  '--color-yellow',
  '--color-yellow-hover',
  '--color-yellow-active',
  '--color-yellow-soft',
  '--color-violet',
  '--color-violet-soft',
  '--color-violet-border',
  '--color-on-primary',
  '--color-error',
  '--color-warning',
  '--color-pure',
  '--color-diagnostic',
  '--color-node-condition',
])

const hexColor = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i
const tokenName = /^--[a-z0-9-]+$/i

// Valeurs par défaut : aucune donnée propre à la machine ni au thème actif.
export function defaultDashboardConfig() {
  return {
    name: 'Sapphire Dashboard',
    description: '',
    themeId: 'sapphire',
    palette: null,
    layoutKey: '',
  }
}

// Vérifie qu'une valeur est une couleur hexadécimale opaque ou translucide.
function isHexColor(value) {
  return typeof value === 'string' && hexColor.test(value)
}

// Extrait uniquement les couleurs connues d'un thème, pour ne pas embarquer tout le catalogue.
export function dashboardPaletteFromTheme(colors) {
  if (!colors || typeof colors !== 'object') return null
  const palette = {}
  for (const token of dashboardPaletteTokens) {
    if (isHexColor(colors[token])) palette[token] = colors[token].toLowerCase()
  }
  return Object.keys(palette).length > 0 ? palette : null
}

// Refuse une configuration douteuse avant de l'écrire dans un workspace.
export function assertDashboardConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw dashboardError('DASHBOARD_CONFIG_INVALID')
  if (typeof value.name !== 'string' || value.name.length > 80) throw dashboardError('DASHBOARD_CONFIG_INVALID')
  if (typeof value.description !== 'string' || value.description.length > 400) throw dashboardError('DASHBOARD_CONFIG_INVALID')
  if (typeof value.themeId !== 'string' || value.themeId.length > 120) throw dashboardError('DASHBOARD_CONFIG_INVALID')
  if (typeof value.layoutKey !== 'string' || value.layoutKey.length > 120) throw dashboardError('DASHBOARD_CONFIG_INVALID')
  if (value.palette !== null && value.palette !== undefined) {
    if (typeof value.palette !== 'object' || Array.isArray(value.palette)) throw dashboardError('DASHBOARD_CONFIG_INVALID')
    const entries = Object.entries(value.palette)
    if (entries.length > 128) throw dashboardError('DASHBOARD_CONFIG_INVALID')
    for (const [token, color] of entries) {
      if (!tokenName.test(token) || !isHexColor(color)) throw dashboardError('DASHBOARD_CONFIG_INVALID')
    }
  }
  return value
}

// Construit une erreur stable, sans dépendre des traductions de l'interface.
export function dashboardError(code) {
  return Object.assign(new Error(code), { code })
}

// Résout la palette réellement exportée : thème courant s'il existe, sinon instantané du workspace, sinon thème par défaut.
export function resolveDashboardPalette(config, themes = []) {
  const selected = themes.find((entry) => entry?.id === config?.themeId)
  const fromTheme = dashboardPaletteFromTheme(selected?.colors)
  if (fromTheme) return fromTheme
  const snapshot = dashboardPaletteFromTheme(config?.palette)
  return snapshot ?? dashboardPaletteFromTheme(themes[0]?.colors)
}

// Clé locale stable pour retrouver la disposition d'un dashboard exporté.
export function dashboardLayoutStorageKey(layoutKey) {
  return `${dashboardLayoutStoragePrefix}:${layoutKey || 'default'}`
}

// Textes du dashboard exporté, construits dans la langue active au moment de l'export.
export function dashboardLabels(t) {
  return {
    run: t('nav.run'),
    live: t('dashboard.live'),
    liveHint: t('dashboard.liveHint'),
    feedbackLive: t('dashboard.feedbackLive'),
    pause: t('simulation.pause'),
    resume: t('simulation.resume'),
    stop: t('simulation.stop'),
    output: t('dashboard.output'),
    currentExecution: t('dashboard.currentExecution'),
    moduleMap: t('dashboard.moduleMap'),
    panels: t('dashboard.panels'),
    light: t('dashboard.light'),
    dark: t('dashboard.dark'),
    appearance: t('theme.appearance'),
    theme: t('dashboard.theme'),
    switchToLight: t('dashboard.switchToLight'),
    switchToDark: t('dashboard.switchToDark'),
    idle: t('dashboard.idle'),
    preparing: t('dashboard.preparing'),
    speed: t('simulation.speed'),
    timeline: t('dashboard.timeline'),
    seekHint: t('dashboard.seekHint'),
    feedbackStarted: t('dashboard.feedbackStarted'),
    feedbackResumed: t('dashboard.feedbackResumed'),
    feedbackPausedAt: t('dashboard.feedbackPausedAt'),
    feedbackStopped: t('dashboard.feedbackStopped'),
    feedbackSpeed: t('dashboard.feedbackSpeed'),
    feedbackLight: t('dashboard.feedbackLight'),
    feedbackDark: t('dashboard.feedbackDark'),
    running: t('simulation.running'),
    paused: t('simulation.paused'),
    completed: t('simulation.completed'),
    stopped: t('simulation.stopped'),
    error: t('exercise.error'),
    noOutput: t('simulation.noOutput'),
    step: t('flow.step'),
    steps: t('simulation.steps'),
    contractsTitle: t('contracts.title'),
    contractsSatisfied: t('contracts.satisfied'),
    contractsViolated: t('contracts.violated'),
    contractRules: Object.fromEntries(contractKinds.map((kind) => [kind, t(`contract.${kind}`)])),
    on: t('dashboard.on'),
    off: t('dashboard.off'),
    inputPressed: t('inputButton.pressed'),
    inputReleased: t('inputButton.released'),
    hidePanel: t('dashboard.hidePanel'),
    showPanel: t('dashboard.showPanel'),
    movePanel: t('dashboard.movePanel'),
    resizePanel: t('dashboard.resizePanel'),
    resetLayout: t('dashboard.resetLayout'),
    layoutReset: t('dashboard.layoutReset'),
    builtWith: t('dashboard.builtWith'),
    offline: t('dashboard.offline'),
    footerTagline: t('dashboard.footerTagline'),
    footerCredit: t('dashboard.footerCredit'),
    repository: t('dashboard.repository'),
    language: t('dashboard.language'),
    autonomous: t('dashboard.autonomous'),
    autonomousHint: t('dashboard.autonomousHint'),
    type: t('dashboard.type'),
    module: t('dashboard.module'),
    moduleLabel: t('card.module'),
    classLabel: t('card.class'),
    notRunning: t('dashboard.notRunning'),
    noWidgets: t('dashboard.noWidgets'),
    screen: t('dashboard.widget.screen'),
    led: t('dashboard.widget.led'),
    rgbLed: t('dashboard.widget.rgbLed'),
    toggleButton: t('dashboard.widget.toggleButton'),
    holdButton: t('dashboard.widget.holdButton'),
    gauge: t('dashboard.widget.gauge'),
    progress: t('dashboard.widget.progress'),
    barChart: t('dashboard.widget.barChart'),
    xyPlot: t('dashboard.widget.xyPlot'),
    oscilloscope: t('dashboard.widget.oscilloscope'),
    heatmap: t('dashboard.widget.heatmap'),
    comment: t('dashboard.widget.comment'),
    xyPlotHint: t('xyPlot.cursorHint'),
    xyPlotEmpty: t('xyPlot.empty'),
    oscilloscopeHint: t('oscilloscope.cursorHint'),
    oscilloscopeEmpty: t('oscilloscope.empty'),
    oscilloscopeChannel: t('oscilloscope.channel'),
    oscilloscopeReset: t('oscilloscope.resetView'),
    oscilloscopeZoomOutX: t('oscilloscope.zoomOutX'),
    oscilloscopeZoomInX: t('oscilloscope.zoomInX'),
    oscilloscopeZoomOutY: t('oscilloscope.zoomOutY'),
    oscilloscopeZoomInY: t('oscilloscope.zoomInY'),
    oscilloscopePanLeft: t('oscilloscope.panLeft'),
    oscilloscopePanRight: t('oscilloscope.panRight'),
    oscilloscopePanUp: t('oscilloscope.panUp'),
    oscilloscopePanDown: t('oscilloscope.panDown'),
    oscilloscopeStretch: t('oscilloscope.stretch'),
    oscilloscopeHideControls: t('oscilloscope.hideControls'),
    oscilloscopeShowControls: t('oscilloscope.showControls'),
    oscilloscopeHideChannel: t('oscilloscope.hideChannel'),
    oscilloscopeShowChannel: t('oscilloscope.showChannel'),
    oscilloscopeDisableChannel: t('oscilloscope.disableChannel'),
    oscilloscopeEnableChannel: t('oscilloscope.enableChannel'),
    oscilloscopeAmplitude: t('oscilloscope.amplitude'),
    oscilloscopeOffset: t('oscilloscope.offset'),
    panelOutput: t('dashboard.output'),
    panelExecution: t('dashboard.moduleMap'),
    closeMenu: t('dashboard.closeMenu'),
    skip: t('dashboard.skip'),
    controls: t('dashboard.controls'),
    widgetsAria: t('dashboard.widgetsAria'),
    noscript: t('dashboard.noscript'),
  }
}
