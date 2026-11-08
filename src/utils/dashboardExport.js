// Construction pure du fichier dashboard.html : données, thèmes, disposition et scripts embarqués.

import { buildLightColors } from './theme.js'
import { dashboardExecutionPanelId, dashboardLabels, dashboardOutputPanelId, dashboardSimulationBudget } from './dashboardConfig.js'
import { packDashboardBento } from './dashboardLayout.js'
import { simulationSpeedMax } from './simulationSpeed.js'
import { repositoryUrl } from './appInfo.js'
import { supportedLanguages, translate, translations } from './translations.js'
import { dashboardStyles } from '../dashboard/styles.js'

// Catalogues embarqués dans l'export : une entrée par langue de l'application.
const dashboardLanguageLabels = Object.fromEntries(supportedLanguages.map(({ id }) => [
  id,
  dashboardLabels((key, values) => translate(id, key, values)),
]))
const dashboardKindTranslations = Object.fromEntries(supportedLanguages.map(({ id }) => [
  id,
  Object.fromEntries(Object.keys(translations.en)
    .filter((key) => key.startsWith('kind.'))
    .map((key) => [key.slice(5), translate(id, key)])),
]))

// Chaque panneau indique sa largeur bento (`full` ou `half`) et son groupe d'affichage.
const panelDefaults = Object.freeze({
  screen: { w: 6, h: 9, span: 'full', group: 'display' },
  heatmap: { w: 6, h: 8, span: 'full', group: 'display' },
  xyPlot: { w: 6, h: 8, span: 'full', group: 'plot' },
  oscilloscope: { w: 6, h: 8, span: 'full', group: 'plot' },
  barChart: { w: 6, h: 7, span: 'full', group: 'plot' },
  progress: { w: 6, h: 4, span: 'full', group: 'indicator' },
  gauge: { w: 3, h: 8, span: 'half', group: 'indicator' },
  led: { w: 3, h: 5, span: 'half', group: 'indicator' },
  rgbLed: { w: 3, h: 5, span: 'half', group: 'indicator' },
  toggleButton: { w: 3, h: 5, span: 'half', group: 'indicator' },
  holdButton: { w: 3, h: 5, span: 'half', group: 'indicator' },
  output: { w: 6, h: 8, span: 'full', group: 'output' },
  execution: { w: 6, h: 5, span: 'full', group: 'execution' },
  comment: { w: 6, h: 4, span: 'full', group: 'comment' },
})

// Ordre initial des groupes : affichages, tracés, indicateurs, sortie, exécution, commentaires.
const panelGroupOrder = Object.freeze({ display: 0, plot: 1, indicator: 2, output: 3, execution: 4, comment: 5 })
const defaultPanel = Object.freeze({ w: 6, h: 6, span: 'full', group: 'plot' })

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

// Empêche une séquence </script> ou un caractère non autorisé en HTML de casser le document hôte.
export function safeInlineScript(source) {
  return String(source ?? '')
    .replace(/<\/script/gi, '<\\/script')
    .replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g, (char) => `\\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
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

// Construit la disposition initiale en deux colonnes bento, groupées par nature de panneau.
export function dashboardDefaultLayout(widgets) {
  const panels = widgets.map((widget) => ({ id: widget.id, ...(panelDefaults[widget.type] ?? defaultPanel) }))
  panels.push({ id: dashboardOutputPanelId, ...panelDefaults.output })
  panels.push({ id: dashboardExecutionPanelId, ...panelDefaults.execution })
  panels.sort((left, right) => (panelGroupOrder[left.group] ?? 1) - (panelGroupOrder[right.group] ?? 1))
  return packDashboardBento(panels)
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
  labels: providedLabels = {},
  kindLabels: providedKindLabels = {},
  project = null,
  language = 'en',
  fonts = {},
  branding = {},
  version = 'dev',
  repository = repositoryUrl,
}) {
  const title = escapeDashboardHtml(String(name ?? '').trim() || 'Sapphire Dashboard')
  const summary = escapeDashboardHtml(description)
  const direction = language === 'ar' ? 'rtl' : 'ltr'
  const labels = dashboardLanguageLabels[language] ?? providedLabels
  const kindLabels = dashboardKindTranslations[language] ?? providedKindLabels
  const defaultLayout = layout ?? dashboardDefaultLayout(widgets)
  const logo = typeof branding?.logo === 'string' && branding.logo.startsWith('data:image/') ? branding.logo : null
  const data = {
    widgets,
    initialStates,
    layout: defaultLayout,
    layoutKey,
    labels,
    translations: dashboardLanguageLabels,
    languages: supportedLanguages,
    kindLabels,
    kindTranslations: dashboardKindTranslations,
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
<a class="db-skip-link" data-skip href="#dashboard-stage">${escapeDashboardHtml(labels.skip ?? 'Skip to widgets')}</a>
<header class="db-header">
  <div class="db-identity">
    <h1 class="db-title">${title}</h1>
    ${summary ? `<p class="db-description">${summary}</p>` : ''}
  </div>
  <div class="db-actions">
    <div class="db-controls" data-controls-group role="group" aria-label="${escapeDashboardHtml(labels.controls ?? 'Execution controls')}">
      <button type="button" class="db-button db-button--primary" data-action="run">${dashboardIcons.run}<span data-run-label>${escapeDashboardHtml(labels.run ?? 'Run')}</span></button>
      <button type="button" class="db-button" data-action="autonomous" title="${escapeDashboardHtml(labels.autonomousHint)}">${dashboardIcons.run}<span>${escapeDashboardHtml(labels.autonomous)}</span></button>
      <button type="button" class="db-button" data-action="pause" disabled>${dashboardIcons.pause}<span>${escapeDashboardHtml(labels.pause ?? 'Pause')}</span></button>
      <button type="button" class="db-button" data-action="stop" disabled>${dashboardIcons.stop}<span>${escapeDashboardHtml(labels.stop ?? 'Stop')}</span></button>
    </div>
    <div class="db-mode" data-mode-group role="group" aria-label="${escapeDashboardHtml(labels.appearance ?? 'Appearance')}">
      <button type="button" class="db-button db-mode__button" data-mode="dark" aria-pressed="true">${dashboardIcons.dark}<span>${escapeDashboardHtml(labels.dark ?? 'Dark')}</span></button>
      <button type="button" class="db-button db-mode__button" data-mode="light" aria-pressed="false">${dashboardIcons.light}<span>${escapeDashboardHtml(labels.light ?? 'Light')}</span></button>
    </div>
    <label class="db-lang">
      <span class="visually-hidden" data-language-label>${escapeDashboardHtml(labels.language ?? 'Language')}</span>
      <select class="db-lang__select" data-language-select>
        ${supportedLanguages.map(({ id, label }) => `<option value="${escapeDashboardHtml(id)}"${id === language ? ' selected' : ''}>${escapeDashboardHtml(label)}</option>`).join('')}
      </select>
    </label>
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
  <div class="db-speed" data-speed-group role="group" aria-label="${escapeDashboardHtml(labels.speed ?? 'Speed')}">
    <span class="db-speed__label" data-speed-label>${escapeDashboardHtml(labels.speed ?? 'Speed')}</span>
    <input type="range" class="db-speed__slider" data-speed-slider min="1" max="${simulationSpeedMax}" step="1" value="1" aria-label="${escapeDashboardHtml(labels.speed ?? 'Speed')}" aria-valuetext="×1">
    <span class="db-speed__value" data-speed-value aria-hidden="true">×1</span>
  </div>
</div>
<main id="dashboard-stage" class="db-stage" data-stage aria-label="${escapeDashboardHtml(labels.widgetsAria ?? 'Dashboard widgets')}"></main>
<div class="db-feedback" data-feedback role="status" aria-live="polite" aria-atomic="true"></div>
<footer class="db-footer">
  <div class="db-footer__brand">
    ${logo ? `<img class="db-footer__logo" src="${escapeDashboardHtml(logo)}" alt="" width="40" height="40">` : '<span class="db-footer__logo db-footer__logo--fallback" aria-hidden="true">S3</span>'}
    <div>
      <p class="db-footer__name">Sapphire 3${version ? ` <span class="db-footer__version" dir="ltr">v${escapeDashboardHtml(version)}</span>` : ''}</p>
      <p class="db-footer__tagline" data-footer-tagline>${escapeDashboardHtml(labels.footerTagline ?? 'Visual programming environment')}</p>
    </div>
  </div>
  <div class="db-footer__credits">
    <p class="db-footer__credit" data-footer-credit>${escapeDashboardHtml(labels.footerCredit ?? 'Designed and developed by')}</p>
    <p class="db-footer__threadlock">Threadlock Systems</p>
    <p class="db-footer__meta" data-footer-meta>${escapeDashboardHtml(labels.offline ?? 'Offline dashboard')} · ${escapeDashboardHtml(labels.builtWith ?? 'Built with Sapphire 3')}</p>
    ${repository ? `<a class="db-github" data-footer-github href="${escapeDashboardHtml(repository)}" target="_blank" rel="noopener noreferrer" dir="ltr" aria-label="${escapeDashboardHtml(labels.repository ?? 'Open the Sapphire 3 repository on GitHub')}" title="${escapeDashboardHtml(labels.repository ?? 'Open the Sapphire 3 repository on GitHub')}"><svg class="db-github__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" fill="currentColor"/></svg><span class="db-github__repo">lalBi94/Sapphire3</span></a>` : ''}
  </div>
</footer>
<noscript><p style="padding:0 24px 24px">${escapeDashboardHtml(labels.noscript ?? 'This dashboard needs JavaScript to run.')}</p></noscript>
<script id="sapphire-dashboard-runtime">${safeInlineScript(runtimeSource)}</script>
<script id="sapphire-dashboard-data" type="application/json">${serializeDashboardJson(data)}</script>
<script id="sapphire-dashboard-client">${safeInlineScript(clientSource)}</script>
</body>
</html>`
}
