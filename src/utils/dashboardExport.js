// Construction pure du fichier dashboard.html : données, thèmes, disposition et scripts embarqués.

import { buildLightColors } from './theme.js'
import { dashboardExecutionPanelId, dashboardOutputPanelId, dashboardSimulationBudget } from './dashboardConfig.js'
import { packDashboardLayout } from './dashboardLayout.js'
import { dashboardStyles } from '../dashboard/styles.js'

const panelDefaults = Object.freeze({
  screen: { w: 6, h: 9 },
  gauge: { w: 3, h: 8 },
  progress: { w: 6, h: 4 },
  led: { w: 2, h: 5 },
  rgbLed: { w: 3, h: 5 },
  barChart: { w: 6, h: 7 },
  heatmap: { w: 6, h: 8 },
  output: { w: 6, h: 8 },
  execution: { w: 6, h: 5 },
})

// Icônes SVG inline, sans dépendance ni requête, alignées sur les traits de l'interface.
const dashboardIcons = Object.freeze({
  run: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.4 12 8l-7 4.6Z" fill="currentColor"/></svg>',
  pause: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4.4" y="3.4" width="2.6" height="9.2" rx=".5" fill="currentColor"/><rect x="9" y="3.4" width="2.6" height="9.2" rx=".5" fill="currentColor"/></svg>',
  stop: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4.2" y="4.2" width="7.6" height="7.6" rx=".6" fill="currentColor"/></svg>',
  panels: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2.8" y="2.8" width="4.4" height="4.4" rx=".5" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="2.8" width="4.4" height="4.4" rx=".5" stroke="currentColor" stroke-width="1.3"/><rect x="2.8" y="8.8" width="4.4" height="4.4" rx=".5" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="8.8" width="4.4" height="4.4" rx=".5" stroke="currentColor" stroke-width="1.3"/></svg>',
  dark: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M12.2 9.7A5.1 5.1 0 0 1 6.3 3.8 5.1 5.1 0 1 0 12.2 9.7Z" fill="currentColor"/></svg>',
  light: '<svg class="db-button__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1.4v2M8 12.6v2M1.4 8h2M12.6 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M12.7 3.3l-1.4 1.4M4.7 11.3l-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
})

// Échappe un texte destiné au HTML, y compris les noms saisis par l'utilisateur.
export function escapeDashboardHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Échappe un JSON inséré dans une balise script sans casser le document.
export function serializeDashboardJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

// Empêche une séquence </script> présente dans un bundle de fermer la balise hôte.
export function safeInlineScript(source) {
  return String(source ?? '').replace(/<\/script/gi, '<\\/script')
}

// Polices embarquées, avec les mêmes sous-ensembles que l'application.
const dashboardFontFaces = [
  { key: 'interLatin', family: 'Inter', weight: '400 700', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  { key: 'interCyrillic', family: 'Inter', weight: '400 700', range: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' },
  { key: 'spaceGrotesk', family: 'Space Grotesk', weight: '500 700', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  { key: 'jetBrainsLatin', family: 'JetBrains Mono', weight: '400 600', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  { key: 'jetBrainsCyrillic', family: 'JetBrains Mono', weight: '400 600', range: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' },
]

// Embarque les polices locales en data URL pour conserver la typographie de l'application hors ligne.
export function dashboardFontCss(fonts = {}) {
  return dashboardFontFaces.map((face) => {
    const source = fonts?.[face.key]
    if (typeof source !== 'string' || !source.startsWith('data:')) return ''
    return `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};font-display:swap;src:url("${source}") format('woff2');unicode-range:${face.range};}`
  }).join('')
}

// Produit les variables CSS des deux variantes à partir de la palette sombre imposée.
export function dashboardThemeCss(palette = {}) {
  const dark = { ...palette }
  const light = buildLightColors(dark)
  const declarations = (colors, mode) => {
    const entries = Object.entries(colors)
      .filter(([token, value]) => /^--[a-z0-9-]+$/i.test(token) && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))
      .map(([token, value]) => `${token}:${value};`)
      .join('')
    return `:root[data-mode="${mode}"]{color-scheme:${mode};${entries}}`
  }
  return `${declarations(dark, 'dark')}${declarations(light, 'light')}`
}

// Construit la disposition initiale : widgets dans l'ordre du canvas, puis sortie et exécution.
export function dashboardDefaultLayout(widgets) {
  const panels = widgets.map((widget) => ({ id: widget.id, ...(panelDefaults[widget.type] ?? panelDefaults.screen) }))
  panels.push({ id: dashboardOutputPanelId, ...panelDefaults.output })
  panels.push({ id: dashboardExecutionPanelId, ...panelDefaults.execution })
  return packDashboardLayout(panels)
}

// Assemble un document HTML unique, sans serveur, CDN, police ni dépendance externe.
export function buildDashboardDocument({
  name,
  description = '',
  palette = {},
  widgets = [],
  initialStates = {},
  layout = null,
  layoutKey = '',
  runtimeSource = '',
  clientSource = '',
  labels = {},
  kindLabels = {},
  project = null,
  language = 'en',
  fonts = {},
  branding = {},
}) {
  const title = escapeDashboardHtml(String(name ?? '').trim() || 'Sapphire Dashboard')
  const summary = escapeDashboardHtml(description)
  const direction = language === 'ar' ? 'rtl' : 'ltr'
  const defaultLayout = layout ?? dashboardDefaultLayout(widgets)
  const logo = typeof branding?.logo === 'string' && branding.logo.startsWith('data:image/') ? branding.logo : null
  const data = {
    widgets,
    initialStates,
    layout: defaultLayout,
    layoutKey,
    labels,
    kindLabels,
    project,
    simulationBudget: dashboardSimulationBudget,
    language,
  }
  return `<!doctype html>
<html lang="${escapeDashboardHtml(language)}" dir="${direction}" data-mode="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Sapphire 3">
<meta name="description" content="${summary}">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:; child-src blob:; connect-src 'none'">
<title>${title}</title>
<style>${dashboardFontCss(fonts)}${dashboardStyles}${dashboardThemeCss(palette)}</style>
</head>
<body>
<a class="db-skip-link" href="#dashboard-stage">${escapeDashboardHtml(labels.skip ?? 'Skip to widgets')}</a>
<header class="db-header">
  <div class="db-identity">
    <p class="db-eyebrow">Sapphire 3</p>
    <h1 class="db-title">${title}</h1>
    ${summary ? `<p class="db-description">${summary}</p>` : ''}
  </div>
  <div class="db-actions">
    <div class="db-controls" role="group" aria-label="${escapeDashboardHtml(labels.controls ?? 'Execution controls')}">
      <button type="button" class="db-button db-button--primary" data-action="run">${dashboardIcons.run}<span data-run-label>${escapeDashboardHtml(labels.run ?? 'Run')}</span></button>
      <button type="button" class="db-button" data-action="pause" disabled>${dashboardIcons.pause}<span>${escapeDashboardHtml(labels.pause ?? 'Pause')}</span></button>
      <button type="button" class="db-button" data-action="stop" disabled>${dashboardIcons.stop}<span>${escapeDashboardHtml(labels.stop ?? 'Stop')}</span></button>
    </div>
    <div class="db-mode" role="group" aria-label="${escapeDashboardHtml(labels.appearance ?? 'Appearance')}">
      <button type="button" class="db-button db-mode__button" data-mode="dark" aria-pressed="true">${dashboardIcons.dark}<span>${escapeDashboardHtml(labels.dark ?? 'Dark')}</span></button>
      <button type="button" class="db-button db-mode__button" data-mode="light" aria-pressed="false">${dashboardIcons.light}<span>${escapeDashboardHtml(labels.light ?? 'Light')}</span></button>
    </div>
    <div class="db-menu">
      <button type="button" class="db-button" data-action="panels" aria-expanded="false">${dashboardIcons.panels}<span>${escapeDashboardHtml(labels.panels ?? 'Panels')}</span></button>
      <div class="db-menu__popover" data-panels-menu hidden></div>
    </div>
  </div>
</header>
<div class="db-toolbar">
  <p class="db-status" data-status data-kind="idle" role="status" aria-live="polite"><span class="db-status__dot" aria-hidden="true"></span><span data-status-label>${escapeDashboardHtml(labels.idle ?? 'Idle')}</span></p>
  <div class="db-progress" title="${escapeDashboardHtml(labels.seekHint ?? 'Click or use the arrow keys to jump to a step; the run pauses immediately.')}">
    <div class="db-progress__fill" data-progress></div>
    <input type="range" class="db-progress__input" data-progress-track min="0" max="0" step="1" value="0" disabled aria-label="${escapeDashboardHtml(labels.timeline ?? 'Execution progress')}" aria-valuetext="${escapeDashboardHtml(labels.idle ?? 'Idle')}">
  </div>
  <div class="db-speed" role="group" aria-label="${escapeDashboardHtml(labels.speed ?? 'Speed')}">
    <span class="db-speed__label">${escapeDashboardHtml(labels.speed ?? 'Speed')}</span>
    <button type="button" class="db-speed__button" data-speed="1" aria-pressed="true">×1</button>
    <button type="button" class="db-speed__button" data-speed="2" aria-pressed="false">×2</button>
    <button type="button" class="db-speed__button" data-speed="3" aria-pressed="false">×3</button>
    <label class="db-speed__custom">×<input type="number" min="1" max="100" step="1" value="1" inputmode="numeric" data-speed-input aria-label="${escapeDashboardHtml(labels.speed ?? 'Speed')}"></label>
  </div>
</div>
<main id="dashboard-stage" class="db-stage" data-stage aria-label="${escapeDashboardHtml(labels.widgetsAria ?? 'Dashboard widgets')}"></main>
<div class="db-feedback" data-feedback role="status" aria-live="polite" aria-atomic="true"></div>
<footer class="db-footer">
  <div class="db-footer__brand">
    ${logo ? `<img class="db-footer__logo" src="${escapeDashboardHtml(logo)}" alt="" width="40" height="40">` : '<span class="db-footer__logo db-footer__logo--fallback" aria-hidden="true">S3</span>'}
    <div>
      <p class="db-footer__name">Sapphire 3</p>
      <p class="db-footer__tagline">${escapeDashboardHtml(labels.footerTagline ?? 'Visual programming environment')}</p>
    </div>
  </div>
  <div class="db-footer__credits">
    <p class="db-footer__credit">${escapeDashboardHtml(labels.footerCredit ?? 'Designed and developed by')}</p>
    <p class="db-footer__threadlock">Threadlock Systems</p>
    <p class="db-footer__meta">${escapeDashboardHtml(labels.offline ?? 'Offline dashboard')} · ${escapeDashboardHtml(labels.builtWith ?? 'Built with Sapphire 3')}</p>
  </div>
</footer>
<noscript><p style="padding:0 24px 24px">${escapeDashboardHtml(labels.noscript ?? 'This dashboard needs JavaScript to run.')}</p></noscript>
<script id="sapphire-dashboard-runtime">${safeInlineScript(runtimeSource)}</script>
<script id="sapphire-dashboard-data" type="application/json">${serializeDashboardJson(data)}</script>
<script id="sapphire-dashboard-client">${safeInlineScript(clientSource)}</script>
</body>
</html>`
}
