// Client autonome du dashboard : rendu des widgets, commandes Run/Pause/Stop et disposition locale.

import {
  dashboardCurrentNode,
  dashboardExecutionInitial,
  dashboardExecutionReducer,
  dashboardNextIndex,
  dashboardNodeMap,
  dashboardPlaybackRate,
  dashboardStatesAt,
  dashboardVisibleOutput,
} from '../utils/dashboardExecution.js'
import uPlot from 'uplot'
import uplotCss from 'uplot/dist/uPlot.min.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'
import katexAMS from '../../node_modules/katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline'
import katexCaligraphicBold from '../../node_modules/katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline'
import katexCaligraphicRegular from '../../node_modules/katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline'
import katexFrakturBold from '../../node_modules/katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline'
import katexFrakturRegular from '../../node_modules/katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline'
import katexMainBold from '../../node_modules/katex/dist/fonts/KaTeX_Main-Bold.woff2?inline'
import katexMainBoldItalic from '../../node_modules/katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline'
import katexMainItalic from '../../node_modules/katex/dist/fonts/KaTeX_Main-Italic.woff2?inline'
import katexMainRegular from '../../node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2?inline'
import katexMathBoldItalic from '../../node_modules/katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline'
import katexMathItalic from '../../node_modules/katex/dist/fonts/KaTeX_Math-Italic.woff2?inline'
import katexSansSerifBold from '../../node_modules/katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline'
import katexSansSerifItalic from '../../node_modules/katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline'
import katexSansSerifRegular from '../../node_modules/katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline'
import katexScriptRegular from '../../node_modules/katex/dist/fonts/KaTeX_Script-Regular.woff2?inline'
import katexSize1Regular from '../../node_modules/katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline'
import katexSize2Regular from '../../node_modules/katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline'
import katexSize3Regular from '../../node_modules/katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline'
import katexSize4Regular from '../../node_modules/katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline'
import katexTypewriterRegular from '../../node_modules/katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline'
import { parseMathText, renderMath } from '../utils/mathText.js'
import { clampSimulationSpeed, liveSpeedDefault, liveTickDelay } from '../utils/simulationSpeed.js'
import { contractLabel } from '../utils/logic/contracts.js'
import { oscilloscopeColor } from '../utils/oscilloscopeColors.js'
import {
  dashboardColumns,
  dashboardRowGap,
  dashboardRowHeight,
  moveDashboardPanel,
  normalizeDashboardLayout,
  readDashboardLayout,
  resizeDashboardPanel,
  scaleDashboardLayout,
  toggleDashboardPanel,
  writeDashboardLayout,
} from '../utils/dashboardLayout.js'
import {
  dashboardExecutionPanelId,
  dashboardLanguageStorageKey,
  dashboardLayoutStorageKey,
  dashboardModeStorageKey,
  dashboardOutputPanelId,
  dashboardThemeStorageKey,
} from '../utils/dashboardConfig.js'

// Les polices KaTeX sont intégrées en data URLs : le dashboard reste autonome, sans requête réseau.
const katexFontMap = {
  'KaTeX_AMS-Regular.woff2': katexAMS,
  'KaTeX_Caligraphic-Bold.woff2': katexCaligraphicBold,
  'KaTeX_Caligraphic-Regular.woff2': katexCaligraphicRegular,
  'KaTeX_Fraktur-Bold.woff2': katexFrakturBold,
  'KaTeX_Fraktur-Regular.woff2': katexFrakturRegular,
  'KaTeX_Main-Bold.woff2': katexMainBold,
  'KaTeX_Main-BoldItalic.woff2': katexMainBoldItalic,
  'KaTeX_Main-Italic.woff2': katexMainItalic,
  'KaTeX_Main-Regular.woff2': katexMainRegular,
  'KaTeX_Math-BoldItalic.woff2': katexMathBoldItalic,
  'KaTeX_Math-Italic.woff2': katexMathItalic,
  'KaTeX_SansSerif-Bold.woff2': katexSansSerifBold,
  'KaTeX_SansSerif-Italic.woff2': katexSansSerifItalic,
  'KaTeX_SansSerif-Regular.woff2': katexSansSerifRegular,
  'KaTeX_Script-Regular.woff2': katexScriptRegular,
  'KaTeX_Size1-Regular.woff2': katexSize1Regular,
  'KaTeX_Size2-Regular.woff2': katexSize2Regular,
  'KaTeX_Size3-Regular.woff2': katexSize3Regular,
  'KaTeX_Size4-Regular.woff2': katexSize4Regular,
  'KaTeX_Typewriter-Regular.woff2': katexTypewriterRegular,
}
const katexCssInlined = katexCss.replace(/src:url\(fonts\/([^)]+\.woff2)\) format\("woff2"\),url\(fonts\/[^)]+\) format\("woff"\),url\(fonts\/[^)]+\) format\("truetype"\)/g, (match, file) => {
  const data = katexFontMap[file]
  return data ? `src:url(${data}) format("woff2")` : match
})

const dataElement = document.getElementById('sapphire-dashboard-data')
const runtimeElement = document.getElementById('sapphire-dashboard-runtime')

// uPlot et KaTeX sont embarqués avec leurs styles et leurs polices, sans requête ni CDN.
const vendorStyle = document.createElement('style')
vendorStyle.textContent = `${uplotCss}\n${katexCssInlined}`
document.head.append(vendorStyle)

// Construit le domaine X commun d'un oscilloscope.
function oscilloscopeXValues(xMin, xMax, samples) {
  const count = Math.max(2, Math.trunc(samples) || 2)
  const values = new Array(count)
  const span = xMax - xMin
  for (let index = 0; index < count; index += 1) values[index] = xMin + (span * index) / (count - 1)
  return values
}

// Prépare les séries uPlot d'un oscilloscope, sans recalculer les valeurs du moteur.
function oscilloscopeData(state, settings = {}, stretch = 1) {
  const channels = Array.isArray(state?.channels) ? state.channels : []
  const samples = Math.max(2, Math.trunc(Number(state?.samples) || 64))
  const xMin = Number.isFinite(state?.xMin) ? state.xMin : -10
  const xMax = Number.isFinite(state?.xMax) && state.xMax > xMin ? state.xMax : xMin + 1
  const x = oscilloscopeXValues(xMin, xMax, samples)
  return [x, ...channels.map((channel) => {
    const setting = settings[channel.id] ?? {}
    const amplitude = Number.isFinite(setting.amplitude) ? setting.amplitude : 1
    const offset = Number.isFinite(setting.offset) ? setting.offset : 0
    return (Array.isArray(channel.values) ? channel.values : []).map((value) => value == null || !Number.isFinite(value) ? null : value * amplitude * stretch + offset)
  })]
}

// Prépare les séries uPlot d'un traceur XY à partir de ses points [x, y].
function xyPlotData(state) {
  const points = Array.isArray(state?.points) ? state.points : []
  const x = points.map((point) => Number(point?.[0]))
  const y = points.map((point) => Number(point?.[1]))
  return [x, y]
}

// Construit une petite icône SVG inline pour les commandes du dashboard.
function dashboardControlIcon(path) {
  return `<svg class="db-oscilloscope__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${path}</svg>`
}

const oscilloscopeIcons = Object.freeze({
  eye: dashboardControlIcon('<path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/>'),
  eyeOff: dashboardControlIcon('<path d="M2 2l12 12M6.6 4.5A7.7 7.7 0 0 1 8 4c4.1 0 6.5 4 6.5 4a10.8 10.8 0 0 1-2.2 2.4M4.2 5.4A10.4 10.4 0 0 0 1.5 8s2.4 4 6.5 4a7.7 7.7 0 0 0 2.4-.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  power: dashboardControlIcon('<path d="M8 2v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4.6 4.3a5 5 0 1 0 6.8 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  powerOff: dashboardControlIcon('<path d="M8 2v5M2 2l12 12M4.6 4.3a5 5 0 0 0 6.8 6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
})

// Convertit un ratio 0..1 en point sur l'arc de jauge, comme la carte Gauge de l'application.
function gaugePoint(ratio) {
  const angle = (135 + 270 * ratio) * (Math.PI / 180)
  return { x: 100 + 74 * Math.cos(angle), y: 100 + 74 * Math.sin(angle) }
}

// Trace l'arc entre deux ratios, avec le grand arc quand c'est nécessaire.
function gaugeArc(from, to) {
  const start = gaugePoint(from)
  const end = gaugePoint(to)
  const large = (to - from) * 270 > 180 ? 1 : 0
  return `M${start.x.toFixed(2)} ${start.y.toFixed(2)} A74 74 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

if (dataElement) {
  start(JSON.parse(dataElement.textContent || '{}'), runtimeElement?.textContent ?? '')
}

// Point d'entrée : construit l'interface puis attend une action explicite de l'utilisateur.
function start(config, runtimeSource) {
  const catalogs = config.translations ?? {}
  const languages = Array.isArray(config.languages) && config.languages.length > 0
    ? config.languages
    : [{ id: config.language ?? 'en', label: 'English' }]
  const fallbackLanguage = catalogs[config.language] ? config.language : (languages[0]?.id ?? 'en')
  const initialLanguage = readLanguage(fallbackLanguage, catalogs)
  let labels = catalogs[initialLanguage] ?? config.labels ?? {}
  let kindLabels = config.kindTranslations?.[initialLanguage] ?? config.kindLabels ?? {}
  const stage = document.querySelector('[data-stage]')
  const status = document.querySelector('[data-status]')
  const statusLabel = document.querySelector('[data-status-label]')
  const progressFill = document.querySelector('[data-progress]')
  const progressTrack = document.querySelector('[data-progress-track]')
  const liveButton = document.querySelector('[data-action="live"]')
  const runButton = document.querySelector('[data-action="run"]')
  const autonomousButton = document.querySelector('[data-action="autonomous"]')
  const runButtonLabel = document.querySelector('[data-run-label]')
  const pauseButton = document.querySelector('[data-action="pause"]')
  const pauseButtonLabel = pauseButton.querySelector('span')
  const stopButton = document.querySelector('[data-action="stop"]')
  const stopButtonLabel = stopButton.querySelector('span')
  const feedback = document.querySelector('[data-feedback]')
  const modeButtons = [...document.querySelectorAll('button[data-mode]')]
  const speedSlider = document.querySelector('[data-speed-slider]')
  const speedValue = document.querySelector('[data-speed-value]')
  const speedLabel = document.querySelector('[data-speed-label]')
  const themeSelect = document.querySelector('[data-theme-select]')
  const themeLabel = document.querySelector('[data-theme-label]')
  const languageSelect = document.querySelector('[data-language-select]')
  const languageLabel = document.querySelector('[data-language-label]')
  const panelsButton = document.querySelector('[data-action="panels"]')
  const panelsButtonLabel = panelsButton.querySelector('span')
  const panelsMenu = document.querySelector('[data-panels-menu]')
  const nodes = dashboardNodeMap(config.project)
  // Les exemples continus déclarent SP3_LIVE ; l'autonome doit lancer le vrai live, pas rejouer un seul passage.
  const liveProject = (config.project?.nodes ?? []).some((node) => node?.kind === 'VariableDeclaration' && node?.properties?.name === 'SP3_LIVE')

  const panels = [
    ...(config.widgets ?? []).map((widget) => ({
      id: widget.id,
      type: widget.type,
      name: widget.type === 'contracts' ? (widget.name || labels.contractsTitle || 'Contracts') : widget.name,
      kind: widget.type === 'contracts' ? (labels.contractsTitle ?? 'Contracts') : (labels[widget.type] ?? widget.type),
      widget,
    })),
    { id: dashboardOutputPanelId, type: 'output', name: labels.output ?? 'Output', kind: labels.output ?? 'Output' },
    { id: dashboardExecutionPanelId, type: 'execution', name: labels.moduleMap ?? labels.currentExecution ?? 'Modules & classes', kind: labels.moduleMap ?? labels.currentExecution ?? 'Modules & classes' },
  ]
  const exportedLayout = new Map((config.layout ?? []).map((entry) => [entry.id, entry]))
  for (const panel of panels) {
    panel.w = exportedLayout.get(panel.id)?.w
    panel.h = exportedLayout.get(panel.id)?.h
  }
  const defaults = normalizeDashboardLayout(config.layout, panels)
  const storageKey = dashboardLayoutStorageKey(config.layoutKey)
  const refs = new Map()
  const inputWidgets = (config.widgets ?? []).filter((widget) => widget.type === 'toggleButton' || widget.type === 'holdButton')
  let state = {
    ...dashboardExecutionInitial,
    layout: readDashboardLayout(window.localStorage, storageKey, defaults, panels),
    mode: readMode(),
    speed: 1,
    liveSpeed: liveSpeedDefault,
    live: false,
    steps: 0,
    themes: Array.isArray(config.themes) ? config.themes : [],
    themeId: readTheme(config.themeId, config.themes),
    language: initialLanguage,
    autonomous: false,
    inputs: Object.fromEntries(inputWidgets.filter((widget) => widget.globalNodeId).map((widget) => [widget.globalNodeId, Boolean(widget.pressed)])),
  }
  let worker = null
  let workerUrl = null
  let liveWorker = null
  let liveWorkerUrl = null
  let liveWaiting = false
  let livePendingInputs = null
  let livePendingEvents = []
  let liveTimer = 0
  let requestId = 0
  let animationFrame = 0
  let lastFrame = 0
  let accumulator = 0
  let resizeFrame = 0
  let feedbackTimer = 0
  let callbackRequest = false
  const inputRepeatTimers = new Map()

  // Construit chaque panneau une seule fois ; les mises à jour ne recréent pas les canevas.
  function buildPanels() {
    for (const panel of panels) {
      const section = document.createElement('section')
      section.className = `db-panel db-panel--${panel.type}`
      section.dataset.panelId = panel.id
      section.setAttribute('aria-label', panel.name)

      const header = document.createElement('header')
      header.className = 'db-panel__header'
      const handle = document.createElement('button')
      handle.type = 'button'
      handle.className = 'db-panel__handle'
      handle.textContent = '⠿'
      handle.title = formatTemplate(labels.movePanel ?? 'Move {name}', { name: panel.name })
      handle.setAttribute('aria-label', handle.title)
      const titles = document.createElement('div')
      titles.className = 'db-panel__titles'
      const title = document.createElement('h2')
      title.className = 'db-panel__title'
      title.textContent = panel.name
      const kind = document.createElement('p')
      kind.className = 'db-panel__kind'
      kind.textContent = panel.kind
      titles.append(title, kind)
      const hide = document.createElement('button')
      hide.type = 'button'
      hide.className = 'db-panel__hide'
      hide.textContent = '×'
      hide.title = formatTemplate(labels.hidePanel ?? 'Hide {name}', { name: panel.name })
      hide.setAttribute('aria-label', hide.title)
      header.append(handle, titles, hide)

      const body = document.createElement('div')
      body.className = `db-panel__body${panel.type === 'output' || panel.type === 'execution' || panel.type === 'contracts' ? ' db-panel__body--stretch' : ''}`
      const resize = document.createElement('button')
      resize.type = 'button'
      resize.className = 'db-panel__resize'
      resize.textContent = '◢'
      resize.title = formatTemplate(labels.resizePanel ?? 'Resize {name}', { name: panel.name })
      resize.setAttribute('aria-label', resize.title)

      section.append(header, body, resize)
      stage.append(section)
      const ref = { panel, section, body, handle, hide, resize, title, kind }
      createContent(ref)
      refs.set(panel.id, ref)

      hide.addEventListener('click', () => {
        state.layout = toggleDashboardPanel(state.layout, panel.id, false)
        applyLayout()
        renderMenu()
        saveLayout()
      })
      bindPointer(handle, panel.id, 'move')
      bindPointer(header, panel.id, 'move', true)
      bindPointer(resize, panel.id, 'resize')
    }
  }

  // Prépare le contenu propre à chaque type de panneau.
  function createContent(ref) {
    const { panel, body } = ref
    if (panel.type === 'screen') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-screen'
      const viewport = document.createElement('div')
      viewport.className = 'db-screen__viewport'
      const canvas = document.createElement('canvas')
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', panel.name)
      viewport.append(canvas)
      const meta = document.createElement('div')
      meta.className = 'db-screen__meta'
      const dimensions = document.createElement('span')
      meta.append(dimensions)
      wrapper.append(viewport, meta)
      body.append(wrapper)
      ref.canvas = canvas
      ref.context = canvas.getContext('2d')
      ref.screenMeta = dimensions
      return
    }
    if (panel.type === 'toggleButton' || panel.type === 'holdButton') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-input'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'db-input__button'
      button.textContent = 'onClick'
      const label = document.createElement('span')
      label.className = 'db-input__label'
      wrapper.append(button, label)
      body.append(wrapper)
      ref.inputButton = button
      ref.inputLabel = label
      const widget = panel.widget
      if (widget?.mode === 'hold') {
        let active = false
        const press = (event) => {
          event.preventDefault()
          if (active) return
          active = true
          handleInputChange(widget, true)
        }
        const release = () => {
          if (!active) return
          active = false
          handleInputChange(widget, false, false)
        }
        button.addEventListener('pointerdown', press)
        button.addEventListener('pointerup', release)
        button.addEventListener('pointerleave', release)
        button.addEventListener('pointercancel', release)
        button.addEventListener('keydown', (event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) press(event) })
        button.addEventListener('keyup', (event) => { if (event.key === ' ' || event.key === 'Enter') release() })
        button.addEventListener('blur', release)
      } else {
        button.addEventListener('click', () => {
          const next = !widget?.pressed
          handleInputChange(widget, next)
          clearInputTimer(widget)
          if (next && widget?.callbackFunctionId) {
            const timer = window.setInterval(() => triggerInputCallback(widget, true), 500)
            inputRepeatTimers.set(widget.id, timer)
          }
        })
      }
      return
    }
    if (panel.type === 'led' || panel.type === 'rgbLed') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-led'
      const dot = document.createElement('span')
      dot.className = 'db-led__dot'
      if (panel.type === 'rgbLed') dot.classList.add('db-led__dot--rgb')
      const label = document.createElement('span')
      label.className = 'db-led__label'
      wrapper.append(dot, label)
      body.append(wrapper)
      ref.dot = dot
      ref.label = label
      return
    }
    if (panel.type === 'gauge') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-gauge'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 200 200')
      svg.setAttribute('role', 'img')
      svg.setAttribute('aria-label', panel.name)
      const gradientId = `db-gauge-${String(panel.id).replace(/[^A-Za-z0-9_-]/g, '')}`
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
      gradient.setAttribute('id', gradientId)
      gradient.setAttribute('x1', '0')
      gradient.setAttribute('y1', '1')
      gradient.setAttribute('x2', '1')
      gradient.setAttribute('y2', '0')
      for (const [offset, token] of [['0%', '--db-primary'], ['55%', '--db-condition'], ['100%', '--db-secondary']]) {
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
        stop.setAttribute('offset', offset)
        stop.setAttribute('style', `stop-color:var(${token})`)
        gradient.append(stop)
      }
      defs.append(gradient)
      const track = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      track.setAttribute('class', 'db-gauge__track')
      track.setAttribute('d', gaugeArc(0, 1))
      track.setAttribute('pathLength', '100')
      const ticks = []
      for (let index = 0; index <= 10; index += 1) {
        const outer = gaugePoint(index / 10)
        const inner = { x: 100 + (outer.x - 100) * 0.84, y: 100 + (outer.y - 100) * 0.84 }
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        tick.setAttribute('class', 'db-gauge__tick')
        tick.setAttribute('x1', inner.x.toFixed(2))
        tick.setAttribute('y1', inner.y.toFixed(2))
        tick.setAttribute('x2', outer.x.toFixed(2))
        tick.setAttribute('y2', outer.y.toFixed(2))
        ticks.push(tick)
      }
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      glow.setAttribute('class', 'db-gauge__glow')
      glow.setAttribute('d', gaugeArc(0, 1))
      glow.setAttribute('pathLength', '100')
      glow.setAttribute('stroke', `url(#${gradientId})`)
      glow.setAttribute('stroke-dasharray', '0 100')
      const value = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      value.setAttribute('class', 'db-gauge__value')
      value.setAttribute('d', gaugeArc(0, 1))
      value.setAttribute('pathLength', '100')
      value.setAttribute('stroke', `url(#${gradientId})`)
      value.setAttribute('stroke-dasharray', '0 100')
      const readout = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      readout.setAttribute('class', 'db-gauge__readout')
      readout.setAttribute('x', '100')
      readout.setAttribute('y', '94')
      readout.setAttribute('text-anchor', 'middle')
      const percent = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      percent.setAttribute('class', 'db-gauge__percent')
      percent.setAttribute('x', '100')
      percent.setAttribute('y', '116')
      percent.setAttribute('text-anchor', 'middle')
      const minimum = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      minimum.setAttribute('class', 'db-gauge__range')
      minimum.setAttribute('x', '34')
      minimum.setAttribute('y', '168')
      minimum.setAttribute('text-anchor', 'middle')
      const maximum = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      maximum.setAttribute('class', 'db-gauge__range')
      maximum.setAttribute('x', '166')
      maximum.setAttribute('y', '168')
      maximum.setAttribute('text-anchor', 'middle')
      svg.append(defs, track, ...ticks, glow, value, readout, percent, minimum, maximum)
      wrapper.append(svg)
      body.append(wrapper)
      ref.valuePath = value
      ref.glowPath = glow
      ref.svg = svg
      ref.readout = readout
      ref.percent = percent
      ref.minimum = minimum
      ref.maximum = maximum
      return
    }
    if (panel.type === 'progress') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-progress-widget'
      const track = document.createElement('div')
      track.className = 'db-progress-widget__track'
      track.setAttribute('role', 'img')
      track.setAttribute('aria-label', panel.name)
      const fill = document.createElement('div')
      fill.className = 'db-progress-widget__fill'
      track.append(fill)
      const meta = document.createElement('div')
      meta.className = 'db-progress-widget__meta'
      const current = document.createElement('span')
      const percent = document.createElement('span')
      meta.append(current, percent)
      wrapper.append(track, meta)
      body.append(wrapper)
      ref.progressFill = fill
      ref.progressTrack = track
      ref.progressCurrent = current
      ref.progressPercent = percent
      return
    }
    if (panel.type === 'barChart') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-bars-widget'
      const plot = document.createElement('div')
      plot.className = 'db-bars'
      plot.setAttribute('role', 'img')
      plot.setAttribute('aria-label', panel.name)
      const bars = document.createElement('div')
      bars.className = 'db-bars__plot'
      plot.append(bars)
      const meta = document.createElement('div')
      meta.className = 'db-bars__meta'
      const minimum = document.createElement('span')
      const maximum = document.createElement('span')
      meta.append(minimum, maximum)
      wrapper.append(plot, meta)
      body.append(wrapper)
      ref.bars = bars
      ref.barPlot = plot
      ref.barMinimum = minimum
      ref.barMaximum = maximum
      return
    }
    if (panel.type === 'heatmap') {
      const wrapper = document.createElement('div')
      wrapper.className = 'db-heatmap'
      wrapper.setAttribute('role', 'img')
      wrapper.setAttribute('aria-label', panel.name)
      body.append(wrapper)
      ref.heatmap = wrapper
      return
    }
    if (panel.type === 'oscilloscope') {
      createOscilloscopeContent(ref)
      return
    }
    if (panel.type === 'xyPlot') {
      createXyPlotContent(ref)
      return
    }
    if (panel.type === 'comment') {
      const text = document.createElement('div')
      text.className = 'db-comment'
      for (const segment of parseMathText(panel.widget?.text ?? '')) {
        if (segment.kind === 'math') {
          const math = document.createElement('span')
          math.className = 'db-comment__math'
          math.innerHTML = renderMath(segment.value)
          text.append(math)
        } else {
          const literal = document.createElement('span')
          literal.className = 'db-comment__text'
          literal.textContent = segment.value
          text.append(literal)
        }
      }
      body.append(text)
      ref.comment = text
      return
    }
    if (panel.type === 'output') {
      const output = document.createElement('div')
      output.className = 'db-output'
      const empty = document.createElement('p')
      empty.className = 'db-empty'
      empty.textContent = labels.noOutput ?? 'No output yet.'
      const lines = document.createElement('div')
      output.append(empty, lines)
      body.append(output)
      ref.output = output
      ref.outputEmpty = empty
      ref.outputLines = lines
      ref.outputCount = 0
      return
    }
    if (panel.type === 'contracts') {
      createContractsContent(ref, body)
      return
    }
    if (panel.type === 'execution') createExecutionContent(ref, body)
  }

  // Crée un élément SVG avec ses attributs.
  function svgNode(name, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name)
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value))
    return element
  }

  // Raccourcit un libellé pour une boîte compacte.
  function shortLabel(value, maximum = 15) {
    const text = String(value ?? '')
    return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text
  }

  // Construit la mini-carte SVG des modules et de leurs dépendances.
  function buildModuleMapSvg(map) {
    const svg = svgNode('svg', {
      class: 'db-map__svg',
      viewBox: `0 0 ${map.width} ${map.height}`,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
    })
    svg.setAttribute('aria-label', labels.moduleMap ?? 'Modules & classes')
    const defs = svgNode('defs')
    const marker = svgNode('marker', {
      id: 'db-map-arrow',
      viewBox: '0 0 8 8',
      refX: '7',
      refY: '4',
      markerWidth: '6',
      markerHeight: '6',
      orient: 'auto',
    })
    marker.append(svgNode('path', { class: 'db-map__arrow', d: 'M0 0 L8 4 L0 8 Z' }))
    defs.append(marker)
    svg.append(defs)
    const names = new Map(map.boxes.map((box) => [box.id, box.name]))
    for (const edge of map.edges ?? []) {
      const path = svgNode('path', { class: 'db-map__edge', d: edge.path, 'marker-end': 'url(#db-map-arrow)' })
      const title = svgNode('title')
      title.textContent = `${names.get(edge.fromId) ?? edge.fromId} → ${names.get(edge.toId) ?? edge.toId}`
      path.append(title)
      svg.append(path)
    }
    const boxes = new Map()
    const titles = new Map()
    for (const box of map.boxes ?? []) {
      const group = svgNode('g', {
        class: `db-map__box${box.kind === 'class' ? ' db-map__box--class' : ''}`,
        'data-module-id': box.id,
      })
      const title = svgNode('title')
      title.textContent = `${box.kind === 'class' ? (labels.classLabel ?? 'Class') : (labels.moduleLabel ?? 'Module')}: ${box.name}`
      const rect = svgNode('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: '4' })
      const text = svgNode('text', {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      })
      text.textContent = shortLabel(box.name)
      group.append(title, rect, text)
      svg.append(group)
      boxes.set(box.id, group)
      titles.set(box.id, { element: title, kind: box.kind, name: box.name })
    }
    return { svg, boxes, titles }
  }

  // Produit le libellé traduit d'une règle de contrat.
  function contractRuleText(contract) {
    return contractLabel(contract, (key, values) => formatTemplate(labels.contractRules?.[key.slice('contract.'.length)] ?? key, values))
  }

  // Identifie une règle précise pour retrouver ses violations.
  function contractKey(contract) {
    return `${contract.nodeId}::${contract.kind}::${JSON.stringify(contract.arguments ?? [])}`
  }

  // Prépare un panneau de contrats groupés par nœud.
  function createContractsContent(ref, body) {
    const wrapper = document.createElement('div')
    wrapper.className = 'db-contracts-widget'
    ref.contractItems = []
    const groups = new Map()
    for (const contract of ref.panel.widget?.contracts ?? []) {
      const group = groups.get(contract.nodeId) ?? { name: contract.nodeName, kind: contract.nodeKind, contracts: [] }
      group.contracts.push(contract)
      groups.set(contract.nodeId, group)
    }
    for (const group of groups.values()) {
      const section = document.createElement('section')
      section.className = 'db-contract-group'
      const heading = document.createElement('h3')
      const title = document.createElement('span')
      title.textContent = group.name || (config.kindLabels?.[group.kind] ?? group.kind)
      const kind = document.createElement('span')
      kind.className = 'db-contract-group__kind'
      kind.textContent = config.kindLabels?.[group.kind] ?? group.kind
      heading.append(title, kind)
      const list = document.createElement('ul')
      list.className = 'db-contract-list'
      for (const contract of group.contracts) {
        const item = document.createElement('li')
        item.className = 'db-contract-item'
        const rule = document.createElement('span')
        rule.className = 'db-contract-item__rule'
        rule.textContent = contractRuleText(contract)
        const status = document.createElement('span')
        status.className = 'db-contract-item__status'
        status.textContent = labels.contractsHint ?? 'Checked during Run.'
        item.append(rule, status)
        list.append(item)
        ref.contractItems.push({ element: item, rule, status, contract })
      }
      section.append(heading, list)
      wrapper.append(section)
    }
    body.append(wrapper)
    ref.contractsWidget = wrapper
  }

  // Met à jour l'état de chaque contrat après un Run borné ou pendant le live.
  function renderContractsWidget(ref) {
    const violations = !state.live && state.result && Array.isArray(state.result.contracts?.violations)
      ? state.result.contracts.violations
      : null
    const byKey = new Map()
    for (const violation of violations ?? []) {
      const key = contractKey(violation)
      const list = byKey.get(key) ?? []
      list.push(violation)
      byKey.set(key, list)
    }
    for (const item of ref.contractItems ?? []) {
      const matches = byKey.get(contractKey(item.contract)) ?? []
      item.element.dataset.status = !violations ? 'idle' : matches.length > 0 ? 'violated' : 'satisfied'
      item.status.textContent = !violations
        ? (labels.contractsHint ?? 'Checked during Run.')
        : matches.length > 0
          ? formatTemplate(labels.contractsStatusViolated ?? 'Violated {count}× · first at step {step} (value {value})', {
              count: matches.length,
              step: matches[0].step ?? '',
              value: String(matches[0].value ?? ''),
            })
          : (labels.contractsStatusSatisfied ?? 'Satisfied')
    }
  }

  // Prépare la mini-carte des modules puis le libellé du nœud courant.
  function createExecutionContent(ref, body) {
    const wrapper = document.createElement('div')
    wrapper.className = 'db-execution'
    const mapWrap = document.createElement('div')
    mapWrap.className = 'db-map'
    if (config.moduleMap?.boxes?.length > 0) {
      const built = buildModuleMapSvg(config.moduleMap)
      mapWrap.append(built.svg)
      ref.mapSvg = built.svg
      ref.mapBoxes = built.boxes
      ref.mapTitles = built.titles
    } else {
      mapWrap.hidden = true
    }
    const step = document.createElement('p')
    step.className = 'db-execution__step'
    const name = document.createElement('p')
    name.className = 'db-execution__name'
    const meta = document.createElement('p')
    meta.className = 'db-execution__meta'
    wrapper.append(mapWrap, step, name, meta)
    body.append(wrapper)
    ref.mapWrap = mapWrap
    ref.step = step
    ref.name = name
    ref.meta = meta
  }

  // Applique la grille responsive sans modifier la disposition enregistrée.
  function applyLayout() {
    const columns = currentColumns()
    stage.style.setProperty('--db-columns', String(columns))
    const scaled = scaleDashboardLayout(state.layout, columns)
    let maximumRow = 6
    for (const entry of scaled) {
      const ref = refs.get(entry.id)
      if (!ref) continue
      ref.section.hidden = !entry.visible
      if (!entry.visible) continue
      ref.section.style.gridColumn = `${entry.x + 1} / span ${entry.w}`
      ref.section.style.gridRow = `${entry.y + 1} / span ${entry.h}`
      maximumRow = Math.max(maximumRow, entry.y + entry.h)
    }
    stage.style.minHeight = `${maximumRow * (dashboardRowHeight + dashboardRowGap)}px`
  }

  // Choisit le nombre de colonnes selon la largeur réellement disponible.
  function currentColumns() {
    const width = stage.clientWidth || window.innerWidth
    if (width >= 980) return dashboardColumns
    if (width >= 680) return 8
    if (width >= 480) return 6
    return 4
  }

  // Enregistre la disposition uniquement dans le navigateur du visiteur.
  function saveLayout() {
    writeDashboardLayout(window.localStorage, storageKey, state.layout)
  }

  // Relit le mode clair ou sombre choisi par le visiteur.
  function readMode() {
    try {
      return window.localStorage.getItem(dashboardModeStorageKey) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  }

  // Relit le thème choisi par le visiteur, ou garde celui proposé par l'éditeur.
  function readTheme(fallback, themes = []) {
    const ids = new Set((Array.isArray(themes) ? themes : []).map((theme) => theme?.id).filter(Boolean))
    try {
      const stored = window.localStorage.getItem(dashboardThemeStorageKey)
      if (stored && ids.has(stored)) return stored
    } catch {
      // Le choix reste actif pour la session si le stockage local est indisponible.
    }
    return ids.has(fallback) ? fallback : (ids.values().next().value ?? '')
  }

  // Relit la langue choisie, si elle existe encore dans les catalogues embarqués.
  function readLanguage(fallback, catalogs) {
    try {
      const stored = window.localStorage.getItem(dashboardLanguageStorageKey)
      if (stored && catalogs[stored]) return stored
    } catch {
      // Le choix reste actif pour la session si le stockage local est indisponible.
    }
    return fallback
  }

  // Met à jour les règles et statuts des panneaux de contrats après un changement de langue.
  function updateContractLabels() {
    for (const ref of refs.values()) {
      if (!ref.contractItems) continue
      for (const item of ref.contractItems) item.rule.textContent = contractRuleText(item.contract)
      renderContractsWidget(ref)
    }
  }

  // Met à jour les libellés accessibles de la mini-carte après un changement de langue.
  function updateModuleMapLabels() {
    const ref = refs.get(dashboardExecutionPanelId)
    if (!ref) return
    if (ref.mapSvg) ref.mapSvg.setAttribute('aria-label', labels.moduleMap ?? 'Modules & classes')
    for (const entry of ref.mapTitles?.values() ?? []) {
      entry.element.textContent = `${entry.kind === 'class' ? (labels.classLabel ?? 'Class') : (labels.moduleLabel ?? 'Module')}: ${entry.name}`
    }
  }

  // Applique la langue choisie à tout le document sans recharger la page.
  function applyLanguage() {
    labels = catalogs[state.language] ?? config.labels ?? {}
    kindLabels = config.kindTranslations?.[state.language] ?? config.kindLabels ?? {}
    document.documentElement.lang = state.language
    document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr'
    if (languageSelect) languageSelect.value = state.language
    if (languageLabel) languageLabel.textContent = labels.language ?? 'Language'
    if (themeLabel) themeLabel.textContent = labels.theme ?? 'Theme'
    if (themeSelect) themeSelect.setAttribute('aria-label', labels.theme ?? 'Theme')
    renderThemeOptions()
    updateModuleMapLabels()
    updateContractLabels()
    if (speedLabel) speedLabel.textContent = labels.speed ?? 'Speed'
    if (speedSlider) speedSlider.setAttribute('aria-label', labels.speed ?? 'Speed')
    if (pauseButtonLabel) pauseButtonLabel.textContent = labels.pause ?? 'Pause'
    if (stopButtonLabel) stopButtonLabel.textContent = labels.stop ?? 'Stop'
    if (liveButton) {
      const span = liveButton.querySelector('span')
      if (span) span.textContent = labels.live ?? 'Run live'
      liveButton.title = labels.liveHint ?? 'Run live'
    }
    autonomousButton.querySelector('span').textContent = labels.autonomous
    autonomousButton.title = liveProject ? (labels.liveHint ?? labels.autonomousHint) : labels.autonomousHint
    if (panelsButtonLabel) panelsButtonLabel.textContent = labels.panels ?? 'Panels'
    for (const button of modeButtons) {
      const span = button.querySelector('span')
      if (span) span.textContent = button.dataset.mode === 'light' ? (labels.light ?? 'Light') : (labels.dark ?? 'Dark')
    }
    if (progressTrack) {
      progressTrack.setAttribute('aria-label', labels.timeline ?? 'Execution progress')
      const progress = progressTrack.closest('.db-progress')
      if (progress) progress.title = labels.seekHint ?? ''
    }
    if (stage) stage.setAttribute('aria-label', labels.widgetsAria ?? 'Dashboard widgets')
    const skip = document.querySelector('[data-skip]')
    if (skip) skip.textContent = labels.skip ?? 'Skip to widgets'
    const controlsGroup = document.querySelector('[data-controls-group]')
    if (controlsGroup) controlsGroup.setAttribute('aria-label', labels.controls ?? 'Execution controls')
    const modeGroup = document.querySelector('[data-mode-group]')
    if (modeGroup) modeGroup.setAttribute('aria-label', labels.appearance ?? 'Appearance')
    const speedGroup = document.querySelector('[data-speed-group]')
    if (speedGroup) speedGroup.setAttribute('aria-label', labels.speed ?? 'Speed')
    for (const panel of panels) {
      if (panel.type === 'output') {
        panel.name = labels.output ?? 'Output'
        panel.kind = panel.name
      } else if (panel.type === 'execution') {
        panel.name = labels.moduleMap ?? labels.currentExecution ?? 'Modules & classes'
        panel.kind = panel.name
      } else if (panel.type === 'contracts') {
        panel.kind = labels.contractsTitle ?? 'Contracts'
        panel.name = panel.widget?.name || panel.kind
      } else {
        panel.kind = labels[panel.type] ?? panel.type
      }
      const ref = refs.get(panel.id)
      if (!ref) continue
      ref.section.setAttribute('aria-label', panel.name)
      if (ref.title) ref.title.textContent = panel.name
      if (ref.kind) ref.kind.textContent = panel.kind
      if (ref.handle) {
        ref.handle.title = formatTemplate(labels.movePanel ?? 'Move {name}', { name: panel.name })
        ref.handle.setAttribute('aria-label', ref.handle.title)
      }
      if (ref.hide) {
        ref.hide.title = formatTemplate(labels.hidePanel ?? 'Hide {name}', { name: panel.name })
        ref.hide.setAttribute('aria-label', ref.hide.title)
      }
      if (ref.resize) {
        ref.resize.title = formatTemplate(labels.resizePanel ?? 'Resize {name}', { name: panel.name })
        ref.resize.setAttribute('aria-label', ref.resize.title)
      }
    }
    const tagline = document.querySelector('[data-footer-tagline]')
    if (tagline) tagline.textContent = labels.footerTagline ?? 'Visual programming environment'
    const credit = document.querySelector('[data-footer-credit]')
    if (credit) credit.textContent = labels.footerCredit ?? 'Designed and developed by'
    const meta = document.querySelector('[data-footer-meta]')
    if (meta) meta.textContent = `${labels.offline ?? 'Offline dashboard'} · ${labels.builtWith ?? 'Built with Sapphire 3'}`
    const github = document.querySelector('[data-footer-github]')
    if (github) {
      const label = labels.repository ?? 'Open the Sapphire 3 repository on GitHub'
      github.setAttribute('aria-label', label)
      github.title = label
    }
    for (const ref of refs.values()) {
      if (ref.oscilloscope) applyOscilloscopeLabels(ref.oscilloscope)
      if (ref.xyPlot) {
        ref.xyPlot.readout.textContent = labels.xyPlotHint ?? 'Move the cursor over the curve.'
        ref.xyPlot.empty.textContent = labels.xyPlotEmpty ?? 'Call SET_FUNCTION to draw the curve.'
      }
    }
    renderMenu()
    renderControls()
    renderStates()
  }

  // Applique le mode et met le sélecteur à jour.
  function applyMode() {
    document.documentElement.dataset.mode = state.mode
    for (const button of modeButtons) {
      const active = button.dataset.mode === state.mode
      button.setAttribute('aria-pressed', String(active))
    }
  }

  // Applique le thème choisi au document.
  function applyTheme() {
    if (!state.themeId) {
      document.documentElement.removeAttribute('data-theme')
      return
    }
    document.documentElement.dataset.theme = state.themeId
    if (themeSelect) themeSelect.value = state.themeId
  }

  // Remplit le sélecteur avec les thèmes embarqués et leurs noms traduits.
  function renderThemeOptions() {
    if (!themeSelect) return
    const themes = state.themes ?? []
    themeSelect.hidden = themes.length === 0
    if (themes.length === 0) {
      themeSelect.replaceChildren()
      return
    }
    const names = config.themeNames?.[state.language] ?? {}
    themeSelect.replaceChildren(...themes.map((theme) => {
      const option = document.createElement('option')
      option.value = theme.id
      option.textContent = names[theme.id] ?? theme.name ?? theme.id
      return option
    }))
    themeSelect.value = state.themeId
  }

  // Peint la valeur et la portion remplie du curseur de vitesse.
  function renderSpeed(speed, live = state.live) {
    if (!speedSlider) return
    const maximum = Math.max(1, Number(speedSlider.max) || 100)
    const range = maximum - 1
    const progress = range > 0 ? ((speed - 1) / range) * 100 : 0
    speedSlider.style.setProperty('--db-speed-progress', `${progress}%`)
    const text = live ? String(speed) : `×${speed}`
    speedSlider.setAttribute('aria-valuetext', text)
    if (speedValue) speedValue.textContent = text
  }

  // Met le curseur de vitesse à jour.
  function applySpeed() {
    const speed = clampSimulationSpeed(state.live ? state.liveSpeed : state.speed)
    if (speedSlider) speedSlider.value = String(speed)
    renderSpeed(speed, state.live)
  }

  // Construit le menu de visibilité de tous les panneaux.
  function renderMenu() {
    panelsMenu.replaceChildren()
    for (const entry of state.layout) {
      const panel = panels.find((item) => item.id === entry.id)
      if (!panel) continue
      const label = document.createElement('label')
      label.className = 'db-menu__item'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = entry.visible !== false
      checkbox.addEventListener('change', () => {
        state.layout = toggleDashboardPanel(state.layout, entry.id, checkbox.checked)
        applyLayout()
        saveLayout()
      })
      const text = document.createElement('span')
      text.textContent = panel.name
      label.append(checkbox, text)
      panelsMenu.append(label)
    }
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'db-menu__reset'
    reset.textContent = labels.resetLayout ?? 'Reset layout'
    reset.addEventListener('click', () => {
      state.layout = defaults.map((entry) => ({ ...entry, visible: true }))
      applyLayout()
      renderMenu()
      saveLayout()
      announce(labels.layoutReset ?? 'Layout reset.')
    })
    panelsMenu.append(reset)
  }

  // Ouvre ou ferme le menu des panneaux.
  function toggleMenu(open = panelsMenu.hidden) {
    panelsMenu.hidden = !open
    panelsButton.setAttribute('aria-expanded', String(open))
    if (open) panelsMenu.querySelector('input')?.focus()
  }

  // Met à jour les commandes et l'indicateur de progression.
  function renderControls() {
    const statusText = {
      idle: labels.idle ?? 'Idle',
      preparing: labels.preparing ?? 'Preparing…',
      running: labels.running ?? 'Running',
      paused: labels.paused ?? 'Paused',
      completed: labels.completed ?? 'Completed',
      error: labels.error ?? 'Error',
    }[state.status] ?? state.status
    status.dataset.kind = state.status
    status.dataset.live = String(Boolean(state.live))
    statusLabel.textContent = state.live ? `${statusText} · ${state.steps} ${labels.steps ?? 'steps'}` : statusText
    if (liveButton) liveButton.disabled = !config.liveWorkerSource || state.live
    runButton.disabled = state.live ? state.status !== 'paused' : state.status === 'running' || state.status === 'preparing'
    autonomousButton.disabled = state.live || state.status === 'running' || state.status === 'preparing' || state.status === 'paused'
    const runLabel = state.status === 'paused' ? (labels.resume ?? 'Resume') : (labels.run ?? 'Run')
    if (runButtonLabel) runButtonLabel.textContent = runLabel
    runButton.title = runLabel
    runButton.setAttribute('aria-label', runLabel)
    pauseButton.disabled = state.status !== 'running' && state.status !== 'preparing'
    stopButton.disabled = state.status === 'idle'
    const total = state.live ? 0 : Array.isArray(state.result?.trace) ? state.result.trace.length : 0
    progressFill.style.width = state.live ? '0%' : total > 0 ? `${Math.min(100, ((state.index + 1) / total) * 100)}%` : '0%'
    progressTrack.disabled = state.live || total === 0
    progressTrack.max = String(Math.max(0, total - 1))
    progressTrack.value = String(state.live ? 0 : state.index)
    if (state.live) {
      progressTrack.setAttribute('aria-valuetext', `${state.steps} ${labels.steps ?? 'steps'}`)
    } else if (total > 0) {
      progressTrack.setAttribute('aria-valuetext', formatTemplate(labels.step ?? 'Step {current} / {total}', { current: state.index + 1, total }))
    } else {
      progressTrack.removeAttribute('aria-valuetext')
    }
  }

  // Met à jour les widgets, la sortie et le nœud courant au pas affiché.
  function renderStates() {
    const states = dashboardStatesAt(state.result, state.index, config.initialStates ?? {})
    for (const widget of config.widgets ?? []) {
      const ref = refs.get(widget.id)
      if (!ref) continue
      renderWidget(ref, widget, states)
    }
    const outputRef = refs.get(dashboardOutputPanelId)
    if (outputRef) {
      const lines = state.status === 'error' && state.result
        ? (state.result.output ?? [])
        : dashboardVisibleOutput(state.result, state.index)
      renderOutput(outputRef, lines)
    }
    const executionRef = refs.get(dashboardExecutionPanelId)
    if (executionRef) renderExecution(executionRef)
  }

  // Rend le widget correspondant à son état courant.
  function renderWidget(ref, widget, states) {
    if (widget.type === 'screen') {
      renderScreen(ref, widget, states.screens?.[widget.id])
    } else if (widget.type === 'led') {
      const value = Boolean(states.leds?.[widget.id]?.value)
      ref.dot.classList.toggle('db-led__dot--on', value)
      ref.label.textContent = value ? (labels.on ?? 'On') : (labels.off ?? 'Off')
    } else if (widget.type === 'toggleButton' || widget.type === 'holdButton') {
      const pressed = Boolean(widget.pressed)
      ref.inputButton.classList.toggle('db-input__button--pressed', pressed)
      ref.inputButton.setAttribute('aria-pressed', String(pressed))
      ref.inputLabel.textContent = pressed ? (labels.inputPressed ?? 'Pressed') : (labels.inputReleased ?? 'Released')
    } else if (widget.type === 'rgbLed') {
      const led = states.rgbLeds?.[widget.id] ?? { red: 0, green: 0, blue: 0 }
      const brightest = Math.max(led.red, led.green, led.blue)
      ref.dot.style.setProperty('--rgb-led-color', `rgb(${led.red} ${led.green} ${led.blue})`)
      ref.dot.style.setProperty('--rgb-led-spread', `${8 + brightest * 0.08}px`)
      ref.label.textContent = `${led.red}, ${led.green}, ${led.blue}`
    } else if (widget.type === 'gauge') {
      const gauge = states.gauges?.[widget.id] ?? { value: widget.min, min: widget.min, max: widget.max }
      const range = gauge.max - gauge.min
      const ratio = range > 0 ? Math.max(0, Math.min(1, (gauge.value - gauge.min) / range)) : 0
      const dash = `${(ratio * 100).toFixed(2)} 100`
      ref.valuePath.setAttribute('stroke-dasharray', dash)
      ref.glowPath.setAttribute('stroke-dasharray', dash)
      ref.readout.textContent = formatNumber(gauge.value)
      ref.percent.textContent = `${Math.round(ratio * 100)}%`
      ref.minimum.textContent = formatNumber(gauge.min)
      ref.maximum.textContent = formatNumber(gauge.max)
      ref.svg.setAttribute('aria-label', `${widget.name}: ${formatNumber(gauge.value)} / ${formatNumber(gauge.max)}`)
    } else if (widget.type === 'progress') {
      const bar = states.progresses?.[widget.id] ?? { value: widget.min, min: widget.min, max: widget.max }
      const range = bar.max - bar.min
      const ratio = range > 0 ? Math.max(0, Math.min(1, (bar.value - bar.min) / range)) : 0
      ref.progressFill.style.width = `${(ratio * 100).toFixed(2)}%`
      ref.progressCurrent.textContent = `${formatNumber(bar.value)} / ${formatNumber(bar.max)}`
      ref.progressPercent.textContent = `${Math.round(ratio * 100)}%`
      ref.progressTrack.setAttribute('aria-label', `${widget.name}: ${formatNumber(bar.value)} / ${formatNumber(bar.max)}`)
    } else if (widget.type === 'barChart') {
      renderBars(ref, states.barCharts?.[widget.id]?.values ?? new Array(widget.size ?? 12).fill(0))
    } else if (widget.type === 'xyPlot') {
      renderXyPlot(ref, widget, states.xyPlots?.[widget.id])
    } else if (widget.type === 'oscilloscope') {
      renderOscilloscope(ref, widget, states.oscilloscopes?.[widget.id])
    } else if (widget.type === 'heatmap') {
      renderHeatmap(ref, widget, states.heatmaps?.[widget.id])
    } else if (widget.type === 'contracts') {
      renderContractsWidget(ref)
    }
  }

  // Prépare la carte d'un oscilloscope : commandes de l'instrument autour du graphique.
  function createOscilloscopeContent(ref) {
    const wrapper = document.createElement('div')
    wrapper.className = 'db-oscilloscope'
    const toolbar = document.createElement('div')
    toolbar.className = 'db-oscilloscope__toolbar'
    const control = (action, text, label) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'db-oscilloscope__control'
      button.dataset.action = action
      button.textContent = text
      button.setAttribute('aria-label', label)
      button.title = label
      return button
    }
    const reset = control('reset', '↺', labels.oscilloscopeReset ?? 'Reset view')
    const zoomOutX = control('zoom-out-x', 'X−', labels.oscilloscopeZoomOutX ?? 'Zoom out X')
    const zoomInX = control('zoom-in-x', 'X+', labels.oscilloscopeZoomInX ?? 'Zoom in X')
    const zoomOutY = control('zoom-out-y', 'Y−', labels.oscilloscopeZoomOutY ?? 'Zoom out Y')
    const zoomInY = control('zoom-in-y', 'Y+', labels.oscilloscopeZoomInY ?? 'Zoom in Y')
    const panLeft = control('pan-left', '←', labels.oscilloscopePanLeft ?? 'Pan left')
    const panRight = control('pan-right', '→', labels.oscilloscopePanRight ?? 'Pan right')
    const panUp = control('pan-up', '↑', labels.oscilloscopePanUp ?? 'Pan up')
    const panDown = control('pan-down', '↓', labels.oscilloscopePanDown ?? 'Pan down')
    const stretchLabel = document.createElement('label')
    stretchLabel.className = 'db-oscilloscope__stretch'
    const stretchText = document.createElement('span')
    stretchText.textContent = labels.oscilloscopeStretch ?? 'Stretch'
    const stretchInput = document.createElement('input')
    stretchInput.type = 'range'
    stretchInput.min = '0.25'
    stretchInput.max = '4'
    stretchInput.step = '0.25'
    stretchInput.value = '1'
    stretchInput.setAttribute('aria-label', labels.oscilloscopeStretch ?? 'Stretch')
    stretchLabel.append(stretchText, stretchInput)
    const hideControls = control('hide-controls', '⌃', labels.oscilloscopeHideControls ?? 'Hide controls')
    toolbar.append(reset, zoomOutX, zoomInX, zoomOutY, zoomInY, panLeft, panRight, panUp, panDown, stretchLabel, hideControls)

    const bodyRow = document.createElement('div')
    bodyRow.className = 'db-oscilloscope__body'
    const channels = document.createElement('div')
    channels.className = 'db-oscilloscope__channels'
    const chartWrap = document.createElement('div')
    chartWrap.className = 'db-oscilloscope__chart-wrap'
    const chart = document.createElement('div')
    chart.className = 'db-oscilloscope__chart'
    chart.setAttribute('role', 'img')
    chart.setAttribute('aria-label', ref.panel.name)
    const empty = document.createElement('p')
    empty.className = 'db-oscilloscope__empty'
    empty.textContent = labels.oscilloscopeEmpty ?? 'No signal yet.'
    const expand = document.createElement('button')
    expand.type = 'button'
    expand.className = 'db-oscilloscope__expand'
    expand.dataset.action = 'show-controls'
    expand.textContent = '⚙'
    expand.setAttribute('aria-label', labels.oscilloscopeShowControls ?? 'Show controls')
    expand.title = labels.oscilloscopeShowControls ?? 'Show controls'
    chartWrap.append(chart, empty, expand)
    bodyRow.append(channels, chartWrap)
    const readout = document.createElement('p')
    readout.className = 'db-oscilloscope__readout'
    readout.textContent = labels.oscilloscopeHint ?? 'Move the cursor over the signal.'
    wrapper.append(toolbar, bodyRow, readout)
    ref.body.append(wrapper)

    const scope = {
      panel: ref.panel,
      wrapper,
      toolbar,
      channels,
      chartWrap,
      chart,
      empty,
      readout,
      expand,
      stretchInput,
      controls: { reset, zoomOutX, zoomInX, zoomOutY, zoomInY, panLeft, panRight, panUp, panDown, hideControls, expand, stretchText },
      plot: null,
      channelsKey: '',
      rowsKey: '',
      resizeObserver: null,
      state: null,
      revision: null,
      channelList: [],
      rows: new Map(),
      settings: {},
      stretch: 1,
      collapsed: false,
    }
    reset.addEventListener('click', () => resetOscilloscopeView(scope))
    zoomOutX.addEventListener('click', () => zoomOscilloscopeAxis(scope, 'x', 1.25))
    zoomInX.addEventListener('click', () => zoomOscilloscopeAxis(scope, 'x', 0.8))
    zoomOutY.addEventListener('click', () => zoomOscilloscopeAxis(scope, 'y', 1.25))
    zoomInY.addEventListener('click', () => zoomOscilloscopeAxis(scope, 'y', 0.8))
    panLeft.addEventListener('click', () => panOscilloscopeAxis(scope, 'x', -0.15))
    panRight.addEventListener('click', () => panOscilloscopeAxis(scope, 'x', 0.15))
    panUp.addEventListener('click', () => panOscilloscopeAxis(scope, 'y', 0.15))
    panDown.addEventListener('click', () => panOscilloscopeAxis(scope, 'y', -0.15))
    stretchInput.addEventListener('input', () => {
      scope.stretch = Math.max(0.25, Math.min(4, Number(stretchInput.value) || 1))
      updateOscilloscopePlot(scope)
    })
    hideControls.addEventListener('click', () => setOscilloscopeCollapsed(scope, true))
    expand.addEventListener('click', () => setOscilloscopeCollapsed(scope, false))
    ref.oscilloscope = scope
  }

  // Replie ou déplie les commandes de l'oscilloscope pour agrandir le graphique.
  function setOscilloscopeCollapsed(scope, collapsed) {
    scope.collapsed = collapsed
    scope.wrapper.classList.toggle('db-oscilloscope--collapsed', collapsed)
  }

  // Rafraîchit une ligne de canal après un changement de réglage.
  function refreshOscilloscopeRow(scope, channel, index) {
    const row = scope.rows.get(channel.id)
    if (!row) return
    const setting = scope.settings[channel.id]
    const visible = setting.visible !== false
    const enabled = setting.enabled !== false
    row.row.classList.toggle('db-oscilloscope__channel--off', !visible || !enabled)
    row.visible.innerHTML = visible ? oscilloscopeIcons.eye : oscilloscopeIcons.eyeOff
    row.visible.setAttribute('aria-pressed', String(visible))
    row.visible.setAttribute('aria-label', formatTemplate(visible ? (labels.oscilloscopeHideChannel ?? 'Hide channel {index}') : (labels.oscilloscopeShowChannel ?? 'Show channel {index}'), { index }))
    row.visible.title = row.visible.getAttribute('aria-label')
    row.enabled.innerHTML = enabled ? oscilloscopeIcons.power : oscilloscopeIcons.powerOff
    row.enabled.setAttribute('aria-pressed', String(enabled))
    row.enabled.setAttribute('aria-label', formatTemplate(enabled ? (labels.oscilloscopeDisableChannel ?? 'Disable channel {index}') : (labels.oscilloscopeEnableChannel ?? 'Enable channel {index}'), { index }))
    row.enabled.title = row.enabled.getAttribute('aria-label')
    row.amplitudeInput.value = String(setting.amplitude)
    row.amplitudeValue.textContent = Number(setting.amplitude).toFixed(1)
    row.offsetInput.value = String(setting.offset)
    row.offsetValue.textContent = Number(setting.offset).toFixed(1)
  }

  // Reconstruit la liste des canaux uniquement lorsque leur identité change.
  function syncOscilloscopeChannels(scope, channels) {
    const key = channels.map((channel) => channel.id).join(',')
    if (key === scope.rowsKey) return
    scope.rowsKey = key
    scope.channelList = channels
    const current = new Set(channels.map((channel) => channel.id))
    for (const id of Object.keys(scope.settings)) {
      if (!current.has(Number(id))) delete scope.settings[id]
    }
    scope.channels.replaceChildren()
    scope.rows.clear()
    for (const [index, channel] of channels.entries()) {
      scope.settings[channel.id] = scope.settings[channel.id] ?? { visible: true, enabled: true, amplitude: 1, offset: 0 }
      const row = document.createElement('div')
      row.className = 'db-oscilloscope__channel'
      const swatch = document.createElement('span')
      swatch.className = 'db-oscilloscope__swatch'
      swatch.style.background = oscilloscopeColor(channel.id)
      const name = document.createElement('span')
      name.className = 'db-oscilloscope__channel-name'
      name.textContent = formatTemplate(labels.oscilloscopeChannel ?? 'Channel {index}', { index: index + 1 })
      const visible = document.createElement('button')
      visible.type = 'button'
      visible.className = 'db-oscilloscope__toggle'
      const enabled = document.createElement('button')
      enabled.type = 'button'
      enabled.className = 'db-oscilloscope__toggle'
      const amplitudeLabel = document.createElement('label')
      amplitudeLabel.className = 'db-oscilloscope__range'
      const amplitudeText = document.createElement('span')
      amplitudeText.textContent = labels.oscilloscopeAmplitude ?? 'Amplitude'
      const amplitudeInput = document.createElement('input')
      amplitudeInput.type = 'range'
      amplitudeInput.min = '0.1'
      amplitudeInput.max = '3'
      amplitudeInput.step = '0.1'
      amplitudeInput.setAttribute('aria-label', `${labels.oscilloscopeAmplitude ?? 'Amplitude'} ${index + 1}`)
      const amplitudeValue = document.createElement('b')
      amplitudeLabel.append(amplitudeText, amplitudeInput, amplitudeValue)
      const offsetLabel = document.createElement('label')
      offsetLabel.className = 'db-oscilloscope__range'
      const offsetText = document.createElement('span')
      offsetText.textContent = labels.oscilloscopeOffset ?? 'Offset'
      const offsetInput = document.createElement('input')
      offsetInput.type = 'range'
      offsetInput.min = '-5'
      offsetInput.max = '5'
      offsetInput.step = '0.1'
      offsetInput.setAttribute('aria-label', `${labels.oscilloscopeOffset ?? 'Offset'} ${index + 1}`)
      const offsetValue = document.createElement('b')
      offsetLabel.append(offsetText, offsetInput, offsetValue)
      row.append(swatch, name, visible, enabled, amplitudeLabel, offsetLabel)
      scope.channels.append(row)
      scope.rows.set(channel.id, { row, visible, enabled, amplitudeInput, amplitudeValue, offsetInput, offsetValue })
      visible.addEventListener('click', () => {
        const setting = scope.settings[channel.id]
        setting.visible = setting.visible === false
        refreshOscilloscopeRow(scope, channel, index)
        updateOscilloscopePlot(scope)
      })
      enabled.addEventListener('click', () => {
        const setting = scope.settings[channel.id]
        setting.enabled = setting.enabled === false
        refreshOscilloscopeRow(scope, channel, index)
        updateOscilloscopePlot(scope)
      })
      amplitudeInput.addEventListener('input', () => {
        scope.settings[channel.id].amplitude = Math.max(0.1, Math.min(3, Number(amplitudeInput.value) || 1))
        refreshOscilloscopeRow(scope, channel, index)
        updateOscilloscopePlot(scope)
      })
      offsetInput.addEventListener('input', () => {
        scope.settings[channel.id].offset = Math.max(-5, Math.min(5, Number(offsetInput.value) || 0))
        refreshOscilloscopeRow(scope, channel, index)
        updateOscilloscopePlot(scope)
      })
      refreshOscilloscopeRow(scope, channel, index)
    }
  }

  // Met à jour les libellés des commandes après un changement de langue.
  function applyOscilloscopeLabels(scope) {
    const set = (button, text) => {
      button.setAttribute('aria-label', text)
      button.title = text
    }
    set(scope.controls.reset, labels.oscilloscopeReset ?? 'Reset view')
    set(scope.controls.zoomOutX, labels.oscilloscopeZoomOutX ?? 'Zoom out X')
    set(scope.controls.zoomInX, labels.oscilloscopeZoomInX ?? 'Zoom in X')
    set(scope.controls.zoomOutY, labels.oscilloscopeZoomOutY ?? 'Zoom out Y')
    set(scope.controls.zoomInY, labels.oscilloscopeZoomInY ?? 'Zoom in Y')
    set(scope.controls.panLeft, labels.oscilloscopePanLeft ?? 'Pan left')
    set(scope.controls.panRight, labels.oscilloscopePanRight ?? 'Pan right')
    set(scope.controls.panUp, labels.oscilloscopePanUp ?? 'Pan up')
    set(scope.controls.panDown, labels.oscilloscopePanDown ?? 'Pan down')
    set(scope.controls.hideControls, labels.oscilloscopeHideControls ?? 'Hide controls')
    set(scope.controls.expand, labels.oscilloscopeShowControls ?? 'Show controls')
    scope.controls.stretchText.textContent = labels.oscilloscopeStretch ?? 'Stretch'
    scope.stretchInput.setAttribute('aria-label', labels.oscilloscopeStretch ?? 'Stretch')
    for (const [index, channel] of scope.channelList.entries()) refreshOscilloscopeRow(scope, channel, index)
  }

  // Calcule les bornes Y visibles du graphique de l'oscilloscope.
  function oscilloscopeBounds(scope) {
    const plot = scope.plot
    if (!plot) return { min: -1, max: 1 }
    let minimum = Infinity
    let maximum = -Infinity
    for (let position = 1; position < plot.series.length; position += 1) {
      if (plot.series[position]?.show === false) continue
      for (const value of plot.data[position] ?? []) {
        if (value == null || !Number.isFinite(value)) continue
        if (value < minimum) minimum = value
        if (value > maximum) maximum = value
      }
    }
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return { min: -1, max: 1 }
    if (maximum - minimum < 1e-9) return { min: minimum - 1, max: maximum + 1 }
    const padding = (maximum - minimum) * 0.1
    return { min: minimum - padding, max: maximum + padding }
  }

  // Remet la vue de l'oscilloscope sur la fenêtre et les bornes naturelles.
  function resetOscilloscopeView(scope) {
    const plot = scope.plot
    if (!plot) return
    const state = scope.state ?? {}
    const xMin = Number.isFinite(state.xMin) ? state.xMin : -10
    const xMax = Number.isFinite(state.xMax) && state.xMax > xMin ? state.xMax : xMin + 1
    plot.setScale('x', { min: xMin, max: xMax })
    plot.setScale('y', oscilloscopeBounds(scope))
  }

  // Zoome un axe de l'oscilloscope sans toucher à l'autre.
  function zoomOscilloscopeAxis(scope, axis, factor) {
    const plot = scope.plot
    if (!plot) return
    const scale = plot.scales[axis]
    if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return
    const span = scale.max - scale.min
    if (!(span > 1e-9)) return
    const center = (scale.min + scale.max) / 2
    const next = (span * factor) / 2
    plot.setScale(axis, { min: center - next, max: center + next })
  }

  // Déplace la fenêtre d'un axe de l'oscilloscope.
  function panOscilloscopeAxis(scope, axis, fraction) {
    const plot = scope.plot
    if (!plot) return
    const scale = plot.scales[axis]
    if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return
    const span = scale.max - scale.min
    if (!(span > 1e-9)) return
    const delta = span * fraction
    plot.setScale(axis, { min: scale.min + delta, max: scale.max + delta })
  }

  // Met à jour les données tracées et la visibilité des séries.
  function updateOscilloscopePlot(scope) {
    const state = scope.state
    const channels = Array.isArray(state?.channels) ? state.channels : []
    if (channels.length === 0) {
      if (scope.plot) scope.plot.destroy()
      if (scope.resizeObserver) scope.resizeObserver.disconnect()
      scope.plot = null
      scope.resizeObserver = null
      scope.chart.replaceChildren()
      scope.empty.hidden = false
      scope.chart.setAttribute('aria-label', `${scope.panel.name}: 0`)
      return
    }
    scope.empty.hidden = true
    const data = oscilloscopeData(state, scope.settings, scope.stretch)
    const channelsKey = channels.map((channel) => channel.id).join(',')
    if (!scope.plot || scope.channelsKey !== channelsKey) {
      if (scope.plot) scope.plot.destroy()
      if (scope.resizeObserver) scope.resizeObserver.disconnect()
      const computed = getComputedStyle(scope.chart)
      const textColor = computed.getPropertyValue('--db-muted').trim() || '#b5b2c2'
      const gridColor = computed.getPropertyValue('--db-grid').trim() || '#ffffff0c'
      const borderColor = computed.getPropertyValue('--db-border').trim() || '#ffffff24'
      const channelTemplate = labels.oscilloscopeChannel ?? 'Channel {index}'
      const hint = labels.oscilloscopeHint ?? 'Move the cursor over the signal.'
      const plot = new uPlot({
        width: Math.max(1, scope.chart.clientWidth),
        height: Math.max(1, scope.chart.clientHeight),
        padding: [8, 8, 0, 0],
        cursor: { drag: { x: true, y: true, setScale: true }, points: { show: false } },
        legend: { show: false },
        scales: { x: { time: false }, y: {} },
        axes: [
          { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
          { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
        ],
        series: [
          {},
          ...channels.map((channel, index) => ({
            label: formatTemplate(channelTemplate, { index: index + 1 }),
            stroke: oscilloscopeColor(channel.id),
            width: 2,
            show: scope.settings[channel.id]?.visible !== false && scope.settings[channel.id]?.enabled !== false,
          })),
        ],
        hooks: {
          setCursor: [(self) => {
            const index = self.cursor?.idx
            if (!Number.isInteger(index) || !Array.isArray(self.data?.[0])) {
              scope.readout.textContent = hint
              return
            }
            const parts = [`x ${formatNumber(self.data[0][index])}`]
            for (let position = 1; position < self.series.length; position += 1) {
              if (self.series[position]?.show === false) continue
              parts.push(`${formatTemplate(channelTemplate, { index: position })} ${formatNumber(self.data[position]?.[index])}`)
            }
            scope.readout.textContent = parts.join(' · ')
          }],
        },
      }, data, scope.chart)
      scope.plot = plot
      scope.revision = Number(state?.revision) || 0
      scope.readout.textContent = hint
      const observer = new ResizeObserver(() => {
        if (!scope.plot) return
        scope.plot.setSize({ width: Math.max(1, scope.chart.clientWidth), height: Math.max(1, scope.chart.clientHeight) })
      })
      observer.observe(scope.chart)
      scope.resizeObserver = observer
    } else {
      scope.plot.setData(data, false)
      const revision = Number(state?.revision) || 0
      if (revision !== scope.revision) {
        scope.revision = revision
        const xMin = Number.isFinite(state?.xMin) ? state.xMin : -10
        const xMax = Number.isFinite(state?.xMax) && state.xMax > xMin ? state.xMax : xMin + 1
        scope.plot.setScale('x', { min: xMin, max: xMax })
        scope.plot.setScale('y', oscilloscopeBounds(scope))
      }
    }
    channels.forEach((channel, index) => scope.plot.setSeries(index + 1, {
      show: scope.settings[channel.id]?.visible !== false && scope.settings[channel.id]?.enabled !== false,
    }))
    scope.chart.setAttribute('aria-label', `${scope.panel.name}: ${channels.length}`)
  }

  // Prépare la carte d'un traceur XY dans le dashboard.
  function createXyPlotContent(ref) {
    const wrapper = document.createElement('div')
    wrapper.className = 'db-xyplot'
    const chart = document.createElement('div')
    chart.className = 'db-xyplot__chart'
    chart.setAttribute('role', 'img')
    chart.setAttribute('aria-label', ref.panel.name)
    const empty = document.createElement('p')
    empty.className = 'db-xyplot__empty'
    empty.textContent = labels.xyPlotEmpty ?? 'Call SET_FUNCTION to draw the curve.'
    const readout = document.createElement('p')
    readout.className = 'db-xyplot__readout'
    readout.textContent = labels.xyPlotHint ?? 'Move the cursor over the curve.'
    wrapper.append(chart, empty, readout)
    ref.body.append(wrapper)
    ref.xyPlot = { chart, empty, readout, plot: null, resizeObserver: null, revision: null, pointsCount: 0 }
  }

  // Trace le traceur XY avec uPlot, sans recréer le graphique à chaque pas.
  function renderXyPlot(ref, widget, state) {
    const scope = ref.xyPlot
    if (!scope) return
    const points = Array.isArray(state?.points) ? state.points : []
    if (points.length < 2) {
      if (scope.plot) scope.plot.destroy()
      if (scope.resizeObserver) scope.resizeObserver.disconnect()
      scope.plot = null
      scope.resizeObserver = null
      scope.revision = null
      scope.pointsCount = 0
      scope.chart.replaceChildren()
      scope.empty.hidden = false
      scope.readout.textContent = labels.xyPlotHint ?? 'Move the cursor over the curve.'
      return
    }
    scope.empty.hidden = true
    const data = xyPlotData(state)
    const revision = Number(state?.revision) || 0
    const xMin = Number.isFinite(Number(state?.xMin)) ? Number(state.xMin) : -10
    const xMax = Number.isFinite(Number(state?.xMax)) && Number(state.xMax) > xMin ? Number(state.xMax) : xMin + 1
    const yMin = Number.isFinite(Number(state?.yMin)) ? Number(state.yMin) : -10
    const yMax = Number.isFinite(Number(state?.yMax)) && Number(state.yMax) > yMin ? Number(state.yMax) : yMin + 1
    if (!scope.plot) {
      const computed = getComputedStyle(scope.chart)
      const textColor = computed.getPropertyValue('--db-muted').trim() || '#b5b2c2'
      const gridColor = computed.getPropertyValue('--db-grid').trim() || '#ffffff0c'
      const borderColor = computed.getPropertyValue('--db-border').trim() || '#ffffff24'
      const primary = computed.getPropertyValue('--db-primary').trim() || '#f5d547'
      const plot = new uPlot({
        width: Math.max(1, scope.chart.clientWidth),
        height: Math.max(1, scope.chart.clientHeight),
        padding: [8, 8, 0, 0],
        cursor: { drag: { x: true, y: true, setScale: true }, points: { show: false } },
        legend: { show: false },
        scales: { x: { time: false, min: xMin, max: xMax }, y: { min: yMin, max: yMax } },
        axes: [
          { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
          { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
        ],
        series: [{}, { stroke: primary, width: 2 }],
        hooks: {
          setCursor: [(self) => {
            const index = self.cursor?.idx
            if (!Number.isInteger(index) || !Array.isArray(self.data?.[0])) {
              scope.readout.textContent = labels.xyPlotHint ?? 'Move the cursor over the curve.'
              return
            }
            scope.readout.textContent = `x ${formatNumber(self.data[0][index])} · y ${formatNumber(self.data[1]?.[index])}`
          }],
        },
      }, data, scope.chart)
      scope.plot = plot
      scope.revision = revision
      scope.pointsCount = points.length
      scope.readout.textContent = labels.xyPlotHint ?? 'Move the cursor over the curve.'
      const observer = new ResizeObserver(() => {
        if (!scope.plot) return
        scope.plot.setSize({ width: Math.max(1, scope.chart.clientWidth), height: Math.max(1, scope.chart.clientHeight) })
      })
      observer.observe(scope.chart)
      scope.resizeObserver = observer
    } else {
      scope.plot.setData(data, false)
      // Pendant l'échantillonnage, la révision reste identique mais le nombre de points augmente :
      // on recadre Y pour que la courbe se dessine progressivement, comme les canaux de l'oscilloscope.
      if (revision !== scope.revision || points.length !== scope.pointsCount) {
        scope.revision = revision
        scope.pointsCount = points.length
        scope.plot.setScale('x', { min: xMin, max: xMax })
        scope.plot.setScale('y', { min: yMin, max: yMax })
      }
    }
    scope.chart.setAttribute('aria-label', `${widget.name}: ${points.length}`)
  }

  // Trace les canaux de l'oscilloscope avec uPlot, sans recréer le graphique à chaque pas.
  function renderOscilloscope(ref, widget, state) {
    const scope = ref.oscilloscope
    if (!scope) return
    scope.state = state
    const channels = Array.isArray(state?.channels) ? state.channels : []
    syncOscilloscopeChannels(scope, channels)
    updateOscilloscopePlot(scope)
    scope.chart.setAttribute('aria-label', `${widget.name}: ${channels.length}`)
  }

  // Dessine le tampon RGBA de l'écran sans interpolation.
  function renderScreen(ref, widget, screen) {
    if (!ref.canvas || !ref.context) return
    const width = Math.max(1, Number(screen?.width ?? widget.width) || 1)
    const height = Math.max(1, Number(screen?.height ?? widget.height) || 1)
    ref.canvas.setAttribute('aria-label', `${widget.name}: ${width} × ${height}`)
    if (ref.screenMeta) ref.screenMeta.textContent = `${width} × ${height}`
    if (ref.canvas.width !== width || ref.canvas.height !== height) {
      ref.canvas.width = width
      ref.canvas.height = height
    }
    const source = screen?.pixels ?? []
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let index = 0; index < pixels.length; index += 1) pixels[index] = Number(source[index]) || 0
    try {
      ref.context.putImageData(new ImageData(pixels, width, height), 0, 0)
    } catch {
      ref.context.clearRect(0, 0, width, height)
    }
  }

  // Recrée les barres seulement lorsque leur nombre change, avec une ligne zéro pour les valeurs signées.
  function renderBars(ref, values) {
    if (ref.bars.childElementCount !== values.length) {
      ref.bars.replaceChildren(...values.map(() => {
        const bar = document.createElement('div')
        bar.className = 'db-bar'
        bar.append(document.createElement('span'))
        return bar
      }))
    }
    const maximum = values.length > 0 ? Math.max(0, ...values) : 0
    const minimum = values.length > 0 ? Math.min(0, ...values) : 0
    const span = maximum - minimum || 1
    const baseline = values.some((value) => value < 0) ? (maximum / span) * 100 : 100
    ref.barPlot.style.setProperty('--db-baseline', `${baseline}%`)
    ref.barPlot.setAttribute('aria-label', `${ref.panel.name}: ${values.slice(0, 16).map(formatNumber).join(', ')}`)
    if (ref.barMinimum) ref.barMinimum.textContent = formatNumber(minimum)
    if (ref.barMaximum) ref.barMaximum.textContent = formatNumber(maximum)
    for (const [index, bar] of [...ref.bars.children].entries()) {
      const value = Number(values[index]) || 0
      const fill = bar.firstElementChild
      const height = (Math.abs(value) / span) * 100
      fill.style.display = value === 0 ? 'none' : 'block'
      fill.style.height = `${height}%`
      fill.style.bottom = value < 0 ? 'auto' : `${100 - baseline}%`
      fill.style.top = value < 0 ? `${baseline}%` : 'auto'
      fill.classList.toggle('db-bar__fill--negative', value < 0)
      bar.title = formatNumber(value)
    }
  }

  // Recrée les cellules seulement lorsque les dimensions changent.
  function renderHeatmap(ref, widget, heatmap) {
    const width = Math.max(1, Number(heatmap?.width ?? widget.width) || 1)
    const height = Math.max(1, Number(heatmap?.height ?? widget.height) || 1)
    const values = heatmap?.values ?? new Array(width * height).fill(0)
    ref.heatmap.setAttribute('aria-label', `${widget.name}: ${width} × ${height}`)
    ref.heatmap.style.gridTemplateColumns = `repeat(${width}, minmax(0, 1fr))`
    ref.heatmap.style.gridTemplateRows = `repeat(${height}, minmax(0, 1fr))`
    if (ref.heatmap.childElementCount !== width * height) {
      ref.heatmap.replaceChildren(...Array.from({ length: width * height }, () => {
        const cell = document.createElement('span')
        cell.className = 'db-heatmap__cell'
        return cell
      }))
    }
    const maximum = Math.max(1, ...values.map((value) => Math.abs(Number(value) || 0)))
    for (const [index, cell] of [...ref.heatmap.children].entries()) {
      const value = Number(values[index]) || 0
      const heat = Math.max(0, Math.min(100, (Math.abs(value) / maximum) * 100))
      cell.style.setProperty('--db-heat', `${heat}%`)
      cell.title = formatNumber(value)
    }
  }

  // Ajoute uniquement les nouvelles lignes de sortie, sans reconstruire tout le panneau.
  function renderOutput(ref, lines) {
    ref.outputEmpty.hidden = lines.length > 0
    if (lines.length !== ref.outputCount) {
      const wasNearBottom = ref.output.scrollHeight - ref.output.scrollTop - ref.output.clientHeight < 32
      ref.outputLines.replaceChildren(...lines.map((line) => {
        const entry = document.createElement('div')
        entry.className = 'db-output__line'
        entry.textContent = line
        return entry
      }))
      ref.outputCount = lines.length
      if (wasNearBottom) ref.output.scrollTop = ref.output.scrollHeight
    }
  }

  // Met en avant la boîte du module ou de la classe en cours, ou son module appelant si le nœud est dans un widget caché.
  function highlightModule(ref, moduleId) {
    const target = ref.mapBoxes?.has(moduleId) ? moduleId : (config.moduleMap?.owners?.[moduleId] ?? '')
    for (const [id, group] of ref.mapBoxes ?? []) {
      group.classList.toggle('db-map__box--active', id === target)
    }
  }

  // Affiche la mini-carte, le type, le nom, le module et le numéro d'étape du nœud courant.
  function renderExecution(ref) {
    if (state.status === 'preparing') {
      ref.step.textContent = labels.preparing ?? 'Preparing…'
      ref.name.textContent = labels.preparing ?? 'Preparing…'
      ref.meta.textContent = ''
      highlightModule(ref, '')
      return
    }
    if (state.status === 'error' && state.error) {
      ref.step.textContent = labels.error ?? 'Error'
      ref.name.textContent = labels.error ?? 'Error'
      ref.meta.textContent = String(state.error)
      highlightModule(ref, '')
      return
    }
    const node = dashboardCurrentNode(state.result, state.index, nodes)
    if (!node) {
      ref.step.textContent = labels.idle ?? 'Idle'
      ref.name.textContent = labels.notRunning ?? 'Not running'
      ref.meta.textContent = ''
      highlightModule(ref, '')
      return
    }
    ref.step.textContent = formatTemplate(labels.step ?? 'Step {current} / {total}', { current: node.step, total: node.total })
    const kind = config.kindLabels?.[node.kind] ?? node.kind
    ref.name.textContent = node.name || kind || (labels.notRunning ?? 'Not running')
    ref.meta.textContent = [kind, node.module ? `${labels.module ?? 'Module'}: ${node.module}` : ''].filter(Boolean).join(' · ')
    highlightModule(ref, node.moduleId)
  }

  // Affiche un retour bref et l'annonce aux technologies d'assistance.
  function announce(message) {
    if (!feedback || !message) return
    feedback.textContent = message
    feedback.dataset.visible = 'true'
    window.clearTimeout(feedbackTimer)
    feedbackTimer = window.setTimeout(() => {
      feedback.dataset.visible = 'false'
      feedback.textContent = ''
    }, 2800)
  }

  // Annonce le pas courant après une mise en pause ou un retour arrière.
  function announcePaused() {
    const total = Array.isArray(state.result?.trace) ? state.result.trace.length : 0
    announce(total > 0
      ? formatTemplate(labels.feedbackPausedAt ?? 'Paused at step {current} / {total}.', { current: state.index + 1, total })
      : (labels.paused ?? 'Paused'))
  }

  // Met la simulation en pause et revient au pas choisi sur la barre.
  function handleSeek(index) {
    if (state.live) return
    state = dashboardExecutionReducer(state, { type: 'seek', index })
    cancelAnimation()
    renderControls()
    renderStates()
    announcePaused()
  }

  // Arrête la répétition éventuelle d'un toggle.
  function clearInputTimer(widget) {
    const timer = inputRepeatTimers.get(widget?.id)
    if (!timer) return
    window.clearInterval(timer)
    inputRepeatTimers.delete(widget.id)
  }

  // Arrête toutes les répétitions de boutons.
  function clearInputTimers() {
    for (const timer of inputRepeatTimers.values()) window.clearInterval(timer)
    inputRepeatTimers.clear()
  }

  // Met à jour un bouton et déclenche son callback ou le modèle historique `isPress`.
  function handleInputChange(widget, pressed, trigger = true) {
    if (!widget) return
    const next = Boolean(pressed)
    if (widget.pressed === next) return
    widget.pressed = next
    if (widget.globalNodeId) state.inputs = { ...state.inputs, [widget.globalNodeId]: next }
    renderStates()
    if (state.live) {
      if (widget.callbackFunctionId && trigger && widget.onClickNodeId) sendLiveEvents([{ nodeId: widget.onClickNodeId, value: next }])
      else if (widget.globalNodeId) sendLiveInputs(state.inputs)
      return
    }
    if (widget.callbackFunctionId) {
      if (!trigger) return
      if (config.liveWorkerSource && widget.onClickNodeId && startLiveDashboard()) {
        sendLiveEvents([{ nodeId: widget.onClickNodeId, value: next }])
        return
      }
      runInputCallback(widget, next)
      return
    }
    if (state.status === 'idle' && !state.result) return
    requestId += 1
    terminateWorker()
    cancelAnimation()
    const autonomous = state.autonomous
    state = dashboardExecutionReducer(state, { type: 'start' })
    state.autonomous = autonomous
    renderControls()
    renderStates()
    announce(labels.feedbackStarted ?? 'Execution started.')
    runProgram(requestId)
  }

  // Déclenche la fonction liée dans le live actif, ou en one-shot borné hors live.
  function triggerInputCallback(widget, pressed) {
    if (!widget?.callbackFunctionId) return
    if (state.live && widget.onClickNodeId) {
      sendLiveEvents([{ nodeId: widget.onClickNodeId, value: Boolean(pressed) }])
      return
    }
    runInputCallback(widget, pressed)
  }

  // Exécute la fonction liée au bouton avec l'état courant.
  function runInputCallback(widget, pressed) {
    if (!widget?.callbackFunctionId) return
    requestId += 1
    terminateWorker()
    cancelAnimation()
    callbackRequest = true
    state = dashboardExecutionReducer(state, { type: 'start' })
    renderControls()
    renderStates()
    announce(labels.feedbackStarted ?? 'Execution started.')
    runProgram(requestId, { functionId: widget.callbackFunctionId, args: [Boolean(pressed)] })
  }

  // Lance une nouvelle session, ou reprend une session en pause.
  function handleRun() {
    callbackRequest = false
    if (state.live) {
      if (state.status !== 'paused') return
      state = { ...state, status: 'running' }
      renderControls()
      scheduleLiveTick()
      announce(labels.feedbackResumed ?? 'Execution resumed.')
      return
    }
    if (state.status === 'paused') {
      state = dashboardExecutionReducer(state, { type: 'resume' })
      renderControls()
      announce(labels.feedbackResumed ?? 'Execution resumed.')
      if (state.result) startAnimation()
      return
    }
    if (state.status === 'running' || state.status === 'preparing') return
    clearInputTimers()
    state.autonomous = false
    requestId += 1
    terminateWorker()
    cancelAnimation()
    state = dashboardExecutionReducer(state, { type: 'start' })
    renderControls()
    renderStates()
    announce(labels.feedbackStarted ?? 'Execution started.')
    runProgram(requestId)
  }

  // Suspend l'animation et conserve l'état visible.
  function handlePause() {
    if (state.live) {
      state = { ...state, status: 'paused' }
      cancelLiveTick()
      renderControls()
      announcePaused()
      return
    }
    state = dashboardExecutionReducer(state, { type: 'pause' })
    cancelAnimation()
    renderControls()
    announcePaused()
  }

  // Démarre le même Run borné, mais la lecture boucle jusqu'à Pause ou Stop.
  function handleAutonomous() {
    if (state.live) return
    if (state.status === 'running' || state.status === 'preparing' || state.status === 'paused') return
    if (liveProject && config.liveWorkerSource) {
      startLiveDashboard()
      announce(labels.liveHint ?? 'Run live')
      return
    }
    callbackRequest = false
    clearInputTimers()
    requestId += 1
    terminateWorker()
    cancelAnimation()
    state = dashboardExecutionReducer(state, { type: 'start' })
    state.autonomous = true
    renderControls()
    renderStates()
    announce(labels.autonomousHint)
    runProgram(requestId)
  }

  // Arrête la session et revient à l'état initial des widgets.
  function handleStop() {
    callbackRequest = false
    if (state.live) {
      stopLiveDashboard()
      return
    }
    clearInputTimers()
    requestId += 1
    terminateWorker()
    cancelAnimation()
    state = dashboardExecutionReducer(state, { type: 'stop' })
    state.autonomous = false
    renderControls()
    renderStates()
    announce(labels.feedbackStopped ?? 'Stopped — session reset.')
  }

  // Démarre le vrai Run live demandé explicitement.
  function handleLive() {
    if (state.live) return
    startLiveDashboard()
  }

  // Lance le moteur réel dans un worker, ou sur le fil courant si le navigateur le refuse.
  function runProgram(id, options = {}) {
    const runtime = window.SapphireDashboardRuntime
    const simulationOptions = {
      maxSteps: config.simulationBudget,
      inputs: state.inputs,
      ...(options.functionId ? { functionId: options.functionId, args: options.args ?? [] } : {}),
    }
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && runtimeSource) {
      try {
        const workerSource = `${runtimeSource}\nself.onmessage = function (event) {
  var data = event.data || {};
  try {
    var result = SapphireDashboardRuntime.simulate(data.project, data.options || {});
    self.postMessage({ id: data.id, result: result });
  } catch (error) {
    self.postMessage({ id: data.id, error: { message: error && error.message ? error.message : String(error), code: error && error.code ? error.code : null } });
  }
};`
        workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
        worker = new Worker(workerUrl)
        worker.onmessage = (event) => {
          const message = event.data ?? {}
          if (id !== requestId || message.id !== id) return
          terminateWorker()
          if (message.error) handleFailure(message.error)
          else handlePrepared(message.result)
        }
        worker.onerror = (event) => {
          event.preventDefault?.()
          if (id !== requestId) return
          terminateWorker()
          handleFailure({ message: event.message || 'Worker failed.', code: 'SIMULATION_FAILED' })
        }
        worker.postMessage({ id, project: config.project, options: simulationOptions })
        return
      } catch {
        terminateWorker()
      }
    }
    if (!runtime || typeof runtime.simulate !== 'function') {
      handleFailure({ message: 'The dashboard runtime is unavailable.', code: 'SIMULATION_FAILED' })
      return
    }
    window.setTimeout(() => {
      if (id !== requestId) return
      try {
        handlePrepared(runtime.simulate(config.project, simulationOptions))
      } catch (error) {
        handleFailure({ message: error?.message ?? String(error), code: error?.code ?? 'SIMULATION_FAILED' })
      }
    }, 30)
  }

  // Installe le résultat validé et démarre l'animation de la trace.
  function handlePrepared(result) {
    state = dashboardExecutionReducer(state, { type: 'prepared', result })
    if (callbackRequest) {
      callbackRequest = false
      const last = Math.max(0, (result?.trace?.length ?? 1) - 1)
      state = dashboardExecutionReducer(state, { type: 'seek', index: last })
      cancelAnimation()
      renderControls()
      renderStates()
      return
    }
    renderControls()
    renderStates()
    if (state.status === 'running') startAnimation()
  }

  // Signale une erreur du worker sans bloquer le dashboard.
  function handleFailure(error) {
    callbackRequest = false
    state = dashboardExecutionReducer(state, { type: 'fail', errorCode: error?.code ?? 'SIMULATION_FAILED', result: null })
    renderControls()
    renderStates()
    announce(labels.error ?? 'Error')
  }

  // Avance la trace selon le temps écoulé, jamais selon une animation préenregistrée.
  function startAnimation() {
    cancelAnimation()
    if (state.status !== 'running' || !state.result) return
    const total = state.result.trace?.length ?? 0
    if (total <= 1) {
      if (state.autonomous) {
        state = { ...state, status: 'running', index: 0 }
        renderControls()
        renderStates()
        return
      }
      state = dashboardExecutionReducer(state, { type: 'tick', advance: 1 })
      renderControls()
      renderStates()
      announce(labels.completed ?? 'Completed')
      return
    }
    const stepsPerSecond = dashboardPlaybackRate(total, state.speed)
    const interval = 1000 / stepsPerSecond
    lastFrame = performance.now()
    accumulator = 0
    function tick(now) {
      if (state.status !== 'running') return
      accumulator += now - lastFrame
      lastFrame = now
      const advance = Math.floor(accumulator / interval)
      if (advance > 0) {
        accumulator -= advance * interval
        if (state.autonomous) {
          state = { ...state, status: 'running', index: dashboardNextIndex(total, state.index, advance, true) }
        } else {
          state = dashboardExecutionReducer(state, { type: 'tick', advance })
        }
        renderControls()
        renderStates()
        if (state.status !== 'running') {
          if (state.status === 'completed') announce(labels.completed ?? 'Completed')
          return
        }
      }
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
  }

  // Annule l'animation sans modifier les états visibles.
  function cancelAnimation() {
    if (animationFrame) window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }

  // Termine le worker et libère son URL blob.
  function terminateWorker() {
    if (worker) {
      worker.terminate()
      worker = null
    }
    if (workerUrl) {
      URL.revokeObjectURL(workerUrl)
      workerUrl = null
    }
  }

  // Annule la reprise programmée du live.
  function cancelLiveTick() {
    if (!liveTimer) return
    window.clearTimeout(liveTimer)
    liveTimer = 0
  }

  // Termine le worker live et libère son URL blob.
  function terminateLiveWorker() {
    cancelLiveTick()
    liveWaiting = false
    livePendingInputs = null
    livePendingEvents = []
    if (liveWorker) {
      liveWorker.terminate()
      liveWorker = null
    }
    if (liveWorkerUrl) {
      URL.revokeObjectURL(liveWorkerUrl)
      liveWorkerUrl = null
    }
  }

  // Envoie les entrées et événements en attente au worker live.
  function flushLiveResponse() {
    if (!liveWorker) return
    const inputs = livePendingInputs ?? {}
    const events = livePendingEvents
    livePendingInputs = null
    livePendingEvents = []
    liveWaiting = false
    liveWorker.postMessage({ type: 'response', inputs, events })
  }

  // Programme la tranche suivante selon la vitesse live.
  function scheduleLiveTick() {
    cancelLiveTick()
    if (!state.live || state.status !== 'running' || !liveWorker || !liveWaiting) return
    liveTimer = window.setTimeout(() => {
      liveTimer = 0
      if (!state.live || state.status !== 'running' || !liveWorker || !liveWaiting) return
      liveWaiting = false
      liveWorker.postMessage({ type: 'tick' })
    }, liveTickDelay(state.liveSpeed))
  }

  // Installe une frame live dans l'état affiché, sans trace bornée.
  function applyLiveFrame(frame) {
    liveWaiting = true
    const result = {
      ok: true,
      output: frame.output ?? [],
      outputSteps: [],
      trace: frame.currentNodeId ? [frame.currentNodeId] : [],
      screens: frame.screens ?? {},
      gauges: frame.gauges ?? {},
      leds: frame.leds ?? {},
      rgbLeds: frame.rgbLeds ?? {},
      progresses: frame.progresses ?? {},
      barCharts: frame.barCharts ?? {},
      xyPlots: frame.xyPlots ?? {},
      oscilloscopes: frame.oscilloscopes ?? {},
      heatmaps: frame.heatmaps ?? {},
    }
    state = {
      ...state,
      live: true,
      status: state.status === 'paused' ? 'paused' : 'running',
      index: 0,
      steps: Number(frame.steps) || 0,
      result,
      error: null,
    }
    renderControls()
    renderStates()
    if (livePendingInputs || livePendingEvents.length > 0) {
      flushLiveResponse()
      return
    }
    if (state.status === 'running') scheduleLiveTick()
  }

  // Traite les messages du worker live.
  function handleLiveMessage(data) {
    if (data.type === 'frame') {
      applyLiveFrame(data.state ?? {})
      return
    }
    if (data.type === 'done') {
      const stopped = data.result?.stopped === true
      terminateLiveWorker()
      state = {
        ...state,
        live: false,
        status: stopped ? 'stopped' : 'completed',
        steps: Number(data.result?.steps) || state.steps,
      }
      renderControls()
      renderStates()
      applySpeed()
      announce(stopped ? (labels.feedbackStopped ?? 'Stopped — session reset.') : (labels.completed ?? 'Completed'))
      return
    }
    if (data.type === 'error') {
      terminateLiveWorker()
      state = { ...state, live: false, status: 'error', error: data.error?.code ?? 'SIMULATION_FAILED', result: null }
      renderControls()
      renderStates()
      applySpeed()
      announce(labels.error ?? 'Error')
    }
  }

  // Démarre le vrai interpréteur coopératif dans un worker dédié.
  function startLiveDashboard() {
    if (!config.liveWorkerSource) return false
    requestId += 1
    terminateWorker()
    cancelAnimation()
    clearInputTimers()
    terminateLiveWorker()
    state = { ...state, ...dashboardExecutionInitial, live: true, steps: 0, status: 'preparing', result: null, error: null, autonomous: false }
    renderControls()
    renderStates()
    applySpeed()
    announce(labels.feedbackLive ?? 'Live execution started.')
    try {
      liveWorkerUrl = URL.createObjectURL(new Blob([config.liveWorkerSource], { type: 'text/javascript' }))
      liveWorker = new Worker(liveWorkerUrl)
      liveWorker.onmessage = (event) => handleLiveMessage(event.data ?? {})
      liveWorker.onerror = (event) => {
        event.preventDefault?.()
        terminateLiveWorker()
        state = { ...state, live: false, status: 'error', error: 'SIMULATION_FAILED', result: null }
        renderControls()
        renderStates()
        announce(labels.error ?? 'Error')
      }
      liveWorker.postMessage({ type: 'start', project: config.project, inputs: state.inputs, sliceSteps: 400 })
      return true
    } catch {
      terminateLiveWorker()
      state = { ...state, live: false, status: 'error', error: 'SIMULATION_FAILED', result: null }
      renderControls()
      renderStates()
      announce(labels.error ?? 'Error')
      return false
    }
  }

  // Arrête le live et revient à l'état initial des widgets.
  function stopLiveDashboard() {
    terminateLiveWorker()
    state = { ...state, ...dashboardExecutionInitial, live: false, steps: 0 }
    renderControls()
    renderStates()
    applySpeed()
    announce(labels.feedbackStopped ?? 'Stopped — session reset.')
  }

  // Envoie les entrées historiques `isPress` au live.
  function sendLiveInputs(inputs) {
    if (!liveWorker) return
    livePendingInputs = inputs
    if (liveWaiting) flushLiveResponse()
  }

  // Envoie les événements onClick au live.
  function sendLiveEvents(events) {
    if (!liveWorker || !Array.isArray(events) || events.length === 0) return
    livePendingEvents.push(...events)
    if (liveWaiting) flushLiveResponse()
  }

  // Capture un déplacement ou un redimensionnement, puis persiste la disposition.
  function bindPointer(handle, panelId, mode, ignoreButtons = false) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      if (ignoreButtons && event.target.closest('button')) return
      event.preventDefault()
      const columns = currentColumns()
      const bounds = stage.getBoundingClientRect()
      const columnWidth = (bounds.width - dashboardRowGap * (columns - 1)) / columns
      const rowUnit = dashboardRowHeight + dashboardRowGap
      const startX = event.clientX
      const startY = event.clientY
      const startLayout = state.layout
      let moved = false
      try { handle.setPointerCapture?.(event.pointerId) } catch { /* capture indisponible */ }
      function move(moveEvent) {
        const dx = Math.round(((moveEvent.clientX - startX) / columnWidth) * (dashboardColumns / columns))
        const dy = Math.round((moveEvent.clientY - startY) / rowUnit)
        if (!moved && dx === 0 && dy === 0) return
        moved = true
        state.layout = mode === 'move'
          ? moveDashboardPanel(startLayout, panelId, dx, dy)
          : resizeDashboardPanel(startLayout, panelId, dx, dy)
        applyLayout()
        refs.get(panelId)?.section.classList.add('db-panel--dragging')
      }
      function end() {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        refs.get(panelId)?.section.classList.remove('db-panel--dragging')
        if (moved) {
          saveLayout()
          renderMenu()
        }
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    })
    handle.addEventListener('keydown', (event) => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!direction) return
      event.preventDefault()
      state.layout = event.shiftKey
        ? resizeDashboardPanel(state.layout, panelId, direction[0], direction[1])
        : moveDashboardPanel(state.layout, panelId, direction[0], direction[1])
      applyLayout()
      saveLayout()
    })
  }

  // Remplace les jetons {nom} d'un libellé traduit.
  function formatTemplate(template, values) {
    return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
  }

  // Affiche un nombre sans décimale inutile.
  function formatNumber(value) {
    const number = Number(value)
    if (!Number.isFinite(number)) return '—'
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
  }

  progressTrack.addEventListener('input', () => handleSeek(progressTrack.value))
  if (liveButton) liveButton.addEventListener('click', handleLive)
  runButton.addEventListener('click', handleRun)
  autonomousButton.addEventListener('click', handleAutonomous)
  pauseButton.addEventListener('click', handlePause)
  stopButton.addEventListener('click', handleStop)
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const next = state.themes.some((theme) => theme.id === themeSelect.value) ? themeSelect.value : state.themeId
      state.themeId = next
      try {
        window.localStorage.setItem(dashboardThemeStorageKey, state.themeId)
      } catch {
        // Le choix reste actif pour la session si le stockage local est indisponible.
      }
      applyTheme()
      const name = themeSelect.selectedOptions?.[0]?.textContent ?? state.themeId
      announce(`${labels.theme ?? 'Theme'} — ${name}`)
    })
  }
  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      const next = languageSelect.value
      state.language = catalogs[next] ? next : (languages[0]?.id ?? 'en')
      try {
        window.localStorage.setItem(dashboardLanguageStorageKey, state.language)
      } catch {
        // Le choix reste actif pour la session si le stockage local est indisponible.
      }
      applyLanguage()
      const name = languages.find((entry) => entry.id === state.language)?.label ?? state.language
      announce(`${labels.language ?? 'Language'} — ${name}`)
    })
  }
  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode === 'light' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(dashboardModeStorageKey, state.mode)
      } catch {
        // Le mode reste actif pour la session si le stockage local est indisponible.
      }
      applyMode()
      announce(state.mode === 'light'
        ? (labels.feedbackLight ?? 'Light theme enabled.')
        : (labels.feedbackDark ?? 'Dark theme enabled.'))
    })
  }
  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      const value = clampSimulationSpeed(speedSlider.value)
      if (state.live) state.liveSpeed = value
      renderSpeed(value, state.live)
    })
    speedSlider.addEventListener('change', () => {
      const value = clampSimulationSpeed(speedSlider.value)
      if (state.live) {
        state.liveSpeed = value
        applySpeed()
        announce(formatTemplate(labels.feedbackSpeed ?? 'Speed ×{speed}.', { speed: value }))
        if (state.status === 'running') scheduleLiveTick()
        return
      }
      state.speed = value
      applySpeed()
      announce(formatTemplate(labels.feedbackSpeed ?? 'Speed ×{speed}.', { speed: state.speed }))
      if (state.status === 'running') startAnimation()
    })
  }
  panelsButton.addEventListener('click', () => toggleMenu())
  document.addEventListener('click', (event) => {
    if (!panelsMenu.hidden && !panelsMenu.contains(event.target) && !panelsButton.contains(event.target)) toggleMenu(false)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panelsMenu.hidden) {
      toggleMenu(false)
      panelsButton.focus()
    }
  })
  window.addEventListener('resize', () => {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0
      applyLayout()
    })
  })
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return
    requestId += 1
    terminateWorker()
    terminateLiveWorker()
  })

  buildPanels()
  applyLayout()
  applyMode()
  applyTheme()
  applySpeed()
  applyLanguage()
  renderControls()
  renderStates()
}
