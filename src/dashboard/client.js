// Client autonome du dashboard : rendu des widgets, commandes Run/Pause/Stop et disposition locale.

import {
  dashboardCurrentNode,
  dashboardExecutionInitial,
  dashboardExecutionReducer,
  dashboardNodeMap,
  dashboardPlaybackRate,
  dashboardStatesAt,
  dashboardVisibleOutput,
} from '../utils/dashboardExecution.js'
import { clampSimulationSpeed } from '../utils/simulationSpeed.js'
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
} from '../utils/dashboardConfig.js'

const dataElement = document.getElementById('sapphire-dashboard-data')
const runtimeElement = document.getElementById('sapphire-dashboard-runtime')

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
  const runButton = document.querySelector('[data-action="run"]')
  const continuousButton = document.querySelector('[data-action="continuous"]')
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
  const languageSelect = document.querySelector('[data-language-select]')
  const languageLabel = document.querySelector('[data-language-label]')
  const panelsButton = document.querySelector('[data-action="panels"]')
  const panelsButtonLabel = panelsButton.querySelector('span')
  const panelsMenu = document.querySelector('[data-panels-menu]')
  const nodes = dashboardNodeMap(config.project)

  const panels = [
    ...(config.widgets ?? []).map((widget) => ({ id: widget.id, type: widget.type, name: widget.name, kind: labels[widget.type] ?? widget.type, widget })),
    { id: dashboardOutputPanelId, type: 'output', name: labels.output ?? 'Output', kind: labels.output ?? 'Output' },
    { id: dashboardExecutionPanelId, type: 'execution', name: labels.currentExecution ?? 'Current execution', kind: labels.currentExecution ?? 'Current execution' },
  ]
  const exportedLayout = new Map((config.layout ?? []).map((entry) => [entry.id, entry]))
  for (const panel of panels) {
    panel.w = exportedLayout.get(panel.id)?.w
    panel.h = exportedLayout.get(panel.id)?.h
  }
  const defaults = normalizeDashboardLayout(config.layout, panels)
  const storageKey = dashboardLayoutStorageKey(config.layoutKey)
  const refs = new Map()
  let state = {
    ...dashboardExecutionInitial,
    layout: readDashboardLayout(window.localStorage, storageKey, defaults, panels),
    mode: readMode(),
    speed: 1,
    language: initialLanguage,
    continuous: false,
  }
  let worker = null
  let workerUrl = null
  let requestId = 0
  let animationFrame = 0
  let lastFrame = 0
  let accumulator = 0
  let resizeFrame = 0
  let feedbackTimer = 0

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
      body.className = `db-panel__body${panel.type === 'output' || panel.type === 'execution' ? ' db-panel__body--stretch' : ''}`
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
    const wrapper = document.createElement('div')
    wrapper.className = 'db-execution'
    const step = document.createElement('p')
    step.className = 'db-execution__step'
    const name = document.createElement('p')
    name.className = 'db-execution__name'
    const meta = document.createElement('p')
    meta.className = 'db-execution__meta'
    wrapper.append(step, name, meta)
    body.append(wrapper)
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

  // Applique la langue choisie à tout le document sans recharger la page.
  function applyLanguage() {
    labels = catalogs[state.language] ?? config.labels ?? {}
    kindLabels = config.kindTranslations?.[state.language] ?? config.kindLabels ?? {}
    document.documentElement.lang = state.language
    document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr'
    if (languageSelect) languageSelect.value = state.language
    if (languageLabel) languageLabel.textContent = labels.language ?? 'Language'
    if (speedLabel) speedLabel.textContent = labels.speed ?? 'Speed'
    if (speedSlider) speedSlider.setAttribute('aria-label', labels.speed ?? 'Speed')
    if (pauseButtonLabel) pauseButtonLabel.textContent = labels.pause ?? 'Pause'
    if (stopButtonLabel) stopButtonLabel.textContent = labels.stop ?? 'Stop'
    continuousButton.querySelector('span').textContent = labels.continuous
    continuousButton.title = labels.continuousHint
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
        panel.name = labels.currentExecution ?? 'Current execution'
        panel.kind = panel.name
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

  // Peint la valeur et la portion remplie du curseur de vitesse.
  function renderSpeed(speed) {
    if (!speedSlider) return
    const maximum = Math.max(1, Number(speedSlider.max) || 100)
    const range = maximum - 1
    const progress = range > 0 ? ((speed - 1) / range) * 100 : 0
    speedSlider.style.setProperty('--db-speed-progress', `${progress}%`)
    speedSlider.setAttribute('aria-valuetext', `×${speed}`)
    if (speedValue) speedValue.textContent = `×${speed}`
  }

  // Met le curseur de vitesse à jour.
  function applySpeed() {
    const speed = clampSimulationSpeed(state.speed)
    if (speedSlider) speedSlider.value = String(speed)
    renderSpeed(speed)
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
    statusLabel.textContent = statusText
    runButton.disabled = state.status === 'running' || state.status === 'preparing'
    continuousButton.disabled = runButton.disabled
    continuousButton.setAttribute('aria-pressed', String(state.continuous))
    speedSlider.disabled = state.continuous
    const runLabel = state.status === 'paused' ? (labels.resume ?? 'Resume') : (labels.run ?? 'Run')
    if (runButtonLabel) runButtonLabel.textContent = runLabel
    runButton.title = runLabel
    runButton.setAttribute('aria-label', runLabel)
    pauseButton.disabled = state.continuous || (state.status !== 'running' && state.status !== 'preparing')
    stopButton.disabled = state.status === 'idle'
    const total = Array.isArray(state.result?.trace) ? state.result.trace.length : 0
    progressFill.style.width = !state.continuous && total > 0 ? `${Math.min(100, ((state.index + 1) / total) * 100)}%` : '0%'
    progressTrack.disabled = state.continuous || total === 0
    progressTrack.max = String(Math.max(0, total - 1))
    progressTrack.value = String(state.index)
    if (total > 0) {
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
    } else if (widget.type === 'heatmap') {
      renderHeatmap(ref, widget, states.heatmaps?.[widget.id])
    }
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
    if (state.continuous || lines.length !== ref.outputCount) {
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

  // Affiche le type, le nom, le module et le numéro d'étape du nœud courant.
  function renderExecution(ref) {
    if (state.status === 'preparing') {
      ref.step.textContent = labels.preparing ?? 'Preparing…'
      ref.name.textContent = labels.preparing ?? 'Preparing…'
      ref.meta.textContent = ''
      return
    }
    if (state.status === 'error' && state.error) {
      ref.step.textContent = labels.error ?? 'Error'
      ref.name.textContent = labels.error ?? 'Error'
      ref.meta.textContent = String(state.error)
      return
    }
    const node = dashboardCurrentNode(state.result, state.index, nodes)
    if (!node) {
      ref.step.textContent = labels.idle ?? 'Idle'
      ref.name.textContent = labels.notRunning ?? 'Not running'
      ref.meta.textContent = ''
      return
    }
    ref.step.textContent = state.continuous
      ? `${labels.continuous} · ${state.result.steps}`
      : formatTemplate(labels.step ?? 'Step {current} / {total}', { current: node.step, total: node.total })
    const kind = config.kindLabels?.[node.kind] ?? node.kind
    ref.name.textContent = node.name || kind || (labels.notRunning ?? 'Not running')
    ref.meta.textContent = [kind, node.module ? `${labels.module ?? 'Module'}: ${node.module}` : ''].filter(Boolean).join(' · ')
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
    if (state.continuous) return
    state = dashboardExecutionReducer(state, { type: 'seek', index })
    cancelAnimation()
    renderControls()
    renderStates()
    announcePaused()
  }

  // Lance une nouvelle session, ou reprend une session en pause.
  function handleRun() {
    if (state.status === 'paused') {
      state = dashboardExecutionReducer(state, { type: 'resume' })
      renderControls()
      announce(labels.feedbackResumed ?? 'Execution resumed.')
      if (state.result) startAnimation()
      return
    }
    if (state.status === 'running' || state.status === 'preparing') return
    state.continuous = false
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
    state = dashboardExecutionReducer(state, { type: 'pause' })
    cancelAnimation()
    renderControls()
    announcePaused()
  }

  // Démarre un Run réel sans historique, exclusivement dans un Worker annulable.
  function handleContinuous() {
    if (state.status === 'running' || state.status === 'preparing') return
    if (typeof Worker === 'undefined' || !runtimeSource) {
      announce(labels.workerRequired)
      return
    }
    requestId += 1
    terminateWorker()
    cancelAnimation()
    state = dashboardExecutionReducer(state, { type: 'start' })
    state.continuous = true
    renderControls()
    renderStates()
    announce(labels.continuousHint)
    runProgram(requestId)
  }

  // Arrête la session et revient à l'état initial des widgets.
  function handleStop() {
    requestId += 1
    terminateWorker()
    cancelAnimation()
    state = dashboardExecutionReducer(state, { type: 'stop' })
    state.continuous = false
    renderControls()
    renderStates()
    announce(labels.feedbackStopped ?? 'Stopped — session reset.')
  }

  // Lance le moteur réel dans un worker, ou sur le fil courant si le navigateur le refuse.
  function runProgram(id) {
    const runtime = window.SapphireDashboardRuntime
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && runtimeSource) {
      try {
        const workerSource = `${runtimeSource}\nself.onmessage = function (event) {
  var data = event.data || {};
  try {
    var options = data.options || {};
    if (options.continuous) {
      var lastUpdate = -Infinity;
      options.onContinuous = function (snapshot) {
        var now = performance.now();
        if (now - lastUpdate < 50) return;
        lastUpdate = now;
        self.postMessage({ id: data.id, live: snapshot() });
      };
    }
    var result = SapphireDashboardRuntime.simulate(data.project, options);
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
          if (message.live && state.continuous) {
            state = { ...state, status: 'running', result: message.live, index: 0 }
            renderControls()
            renderStates()
            return
          }
          terminateWorker()
          if (message.error) handleFailure(message.error)
          else if (state.continuous) {
            state = { ...state, status: message.result.ok ? 'completed' : 'error', result: message.result, index: 0, error: message.result.errorCode ?? null }
            renderControls()
            renderStates()
            announce(message.result.ok ? labels.completed : labels.error)
          }
          else handlePrepared(message.result)
        }
        worker.onerror = (event) => {
          event.preventDefault?.()
          if (id !== requestId) return
          terminateWorker()
          handleFailure({ message: event.message || 'Worker failed.', code: 'SIMULATION_FAILED' })
        }
        worker.postMessage({ id, project: config.project, options: { maxSteps: config.simulationBudget, continuous: state.continuous } })
        return
      } catch {
        terminateWorker()
      }
    }
    if (state.continuous) {
      handleFailure({ code: 'SIMULATION_FAILED' })
      announce(labels.workerRequired)
      return
    }
    if (!runtime || typeof runtime.simulate !== 'function') {
      handleFailure({ message: 'The dashboard runtime is unavailable.', code: 'SIMULATION_FAILED' })
      return
    }
    window.setTimeout(() => {
      if (id !== requestId) return
      try {
        handlePrepared(runtime.simulate(config.project, { maxSteps: config.simulationBudget }))
      } catch (error) {
        handleFailure({ message: error?.message ?? String(error), code: error?.code ?? 'SIMULATION_FAILED' })
      }
    }, 30)
  }

  // Installe le résultat validé et démarre l'animation de la trace.
  function handlePrepared(result) {
    state = dashboardExecutionReducer(state, { type: 'prepared', result })
    renderControls()
    renderStates()
    if (state.status === 'running') startAnimation()
  }

  // Signale une erreur du worker sans bloquer le dashboard.
  function handleFailure(error) {
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
        state = dashboardExecutionReducer(state, { type: 'tick', advance })
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
  runButton.addEventListener('click', handleRun)
  continuousButton.addEventListener('click', handleContinuous)
  pauseButton.addEventListener('click', handlePause)
  stopButton.addEventListener('click', handleStop)
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
      renderSpeed(clampSimulationSpeed(speedSlider.value))
    })
    speedSlider.addEventListener('change', () => {
      state.speed = clampSimulationSpeed(speedSlider.value)
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
  })

  buildPanels()
  applyLayout()
  applyMode()
  applySpeed()
  applyLanguage()
}
