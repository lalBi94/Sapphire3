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
}) {
  const title = escapeDashboardHtml(String(name ?? '').trim() || 'Sapphire Dashboard')
  const summary = escapeDashboardHtml(description)
  const direction = language === 'ar' ? 'rtl' : 'ltr'
  const defaultLayout = layout ?? dashboardDefaultLayout(widgets)
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; worker-src blob:; child-src blob:; connect-src 'none'; font-src 'none'">
<title>${title}</title>
<style>${dashboardStyles}${dashboardThemeCss(palette)}</style>
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
      <button type="button" class="db-button db-button--primary" data-action="run">${escapeDashboardHtml(labels.run ?? 'Run')}</button>
      <button type="button" class="db-button" data-action="pause" disabled>${escapeDashboardHtml(labels.pause ?? 'Pause')}</button>
      <button type="button" class="db-button" data-action="stop" disabled>${escapeDashboardHtml(labels.stop ?? 'Stop')}</button>
    </div>
    <button type="button" class="db-button" data-action="theme" aria-pressed="false">${escapeDashboardHtml(labels.light ?? 'Light')}</button>
    <div class="db-menu">
      <button type="button" class="db-button" data-action="panels" aria-expanded="false">${escapeDashboardHtml(labels.panels ?? 'Panels')}</button>
      <div class="db-menu__popover" data-panels-menu hidden></div>
    </div>
  </div>
</header>
<div class="db-toolbar">
  <p class="db-status" data-status data-kind="idle" role="status" aria-live="polite"><span class="db-status__dot" aria-hidden="true"></span><span data-status-label>${escapeDashboardHtml(labels.idle ?? 'Idle')}</span></p>
  <div class="db-progress" aria-hidden="true"><div class="db-progress__fill" data-progress></div></div>
</div>
<main id="dashboard-stage" class="db-stage" data-stage aria-label="${escapeDashboardHtml(labels.widgetsAria ?? 'Dashboard widgets')}"></main>
<footer class="db-footer">
  <span>${escapeDashboardHtml(labels.offline ?? 'Offline dashboard')}</span>
  <span>${escapeDashboardHtml(labels.builtWith ?? 'Built with Sapphire 3')}</span>
</footer>
<noscript><p style="padding:0 24px 24px">${escapeDashboardHtml(labels.noscript ?? 'This dashboard needs JavaScript to run.')}</p></noscript>
<script id="sapphire-dashboard-runtime">${safeInlineScript(runtimeSource)}</script>
<script id="sapphire-dashboard-data" type="application/json">${serializeDashboardJson(data)}</script>
<script id="sapphire-dashboard-client">${safeInlineScript(clientSource)}</script>
</body>
</html>`
}
