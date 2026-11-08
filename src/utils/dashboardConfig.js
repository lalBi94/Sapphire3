// Configuration d'export du dashboard web, indépendante de React et du stockage.

export const dashboardSimulationBudget = 20000
export const dashboardLayoutStoragePrefix = 'sapphire3-dashboard-layout'
export const dashboardModeStorageKey = 'sapphire3-dashboard-mode'
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
    pause: t('simulation.pause'),
    resume: t('simulation.resume'),
    stop: t('simulation.stop'),
    output: t('dashboard.output'),
    currentExecution: t('dashboard.currentExecution'),
    panels: t('dashboard.panels'),
    light: t('dashboard.light'),
    dark: t('dashboard.dark'),
    switchToLight: t('dashboard.switchToLight'),
    switchToDark: t('dashboard.switchToDark'),
    idle: t('dashboard.idle'),
    preparing: t('dashboard.preparing'),
    running: t('simulation.running'),
    paused: t('simulation.paused'),
    completed: t('simulation.completed'),
    stopped: t('simulation.stopped'),
    error: t('exercise.error'),
    noOutput: t('simulation.noOutput'),
    step: t('flow.step'),
    on: t('dashboard.on'),
    off: t('dashboard.off'),
    hidePanel: t('dashboard.hidePanel'),
    showPanel: t('dashboard.showPanel'),
    movePanel: t('dashboard.movePanel'),
    resizePanel: t('dashboard.resizePanel'),
    resetLayout: t('dashboard.resetLayout'),
    layoutReset: t('dashboard.layoutReset'),
    builtWith: t('dashboard.builtWith'),
    offline: t('dashboard.offline'),
    type: t('dashboard.type'),
    module: t('dashboard.module'),
    notRunning: t('dashboard.notRunning'),
    noWidgets: t('dashboard.noWidgets'),
    screen: t('dashboard.widget.screen'),
    led: t('dashboard.widget.led'),
    rgbLed: t('dashboard.widget.rgbLed'),
    gauge: t('dashboard.widget.gauge'),
    progress: t('dashboard.widget.progress'),
    barChart: t('dashboard.widget.barChart'),
    heatmap: t('dashboard.widget.heatmap'),
    panelOutput: t('dashboard.output'),
    panelExecution: t('dashboard.currentExecution'),
    closeMenu: t('dashboard.closeMenu'),
    skip: t('dashboard.skip'),
    controls: t('dashboard.controls'),
    widgetsAria: t('dashboard.widgetsAria'),
    noscript: t('dashboard.noscript'),
  }
}
