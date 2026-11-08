import test from 'node:test'
import assert from 'node:assert/strict'
import { examples } from '../../src/utils/examples.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { dashboardLabels, dashboardPaletteFromTheme, defaultDashboardConfig, assertDashboardConfig, resolveDashboardPalette, dashboardLayoutStorageKey } from '../../src/utils/dashboardConfig.js'
import {
  dashboardColumns,
  moveDashboardPanel,
  normalizeDashboardLayout,
  packDashboardLayout,
  readDashboardLayout,
  resizeDashboardPanel,
  scaleDashboardLayout,
  toggleDashboardPanel,
  writeDashboardLayout,
} from '../../src/utils/dashboardLayout.js'
import {
  dashboardCurrentNode,
  dashboardExecutionInitial,
  dashboardExecutionReducer,
  dashboardNextIndex,
  dashboardNodeMap,
  dashboardPlaybackRate,
  dashboardStatesAt,
  dashboardVisibleOutput,
} from '../../src/utils/dashboardExecution.js'
import { dashboardInitialStates, dashboardWidgets } from '../../src/utils/dashboardWidgets.js'
import { initialDocument, reduceDocument } from '../../src/utils/canvasDocument.js'
import {
  buildDashboardDocument,
  dashboardDefaultLayout,
  dashboardFontCss,
  dashboardThemeCss,
  escapeDashboardHtml,
  safeInlineScript,
  serializeDashboardJson,
} from '../../src/utils/dashboardExport.js'
import { translate } from '../../src/utils/translations.js'
import { simulateProgram } from '../../src/utils/logic/index.js'

// Charge un exemple local comme document de travail, sans passer par l'interface.
function exampleWorkspace(id) {
  return deserializeWorkspace(JSON.stringify(examples.find((example) => example.id === id).build()))
}

// Construit une configuration d'export complète et déterministe pour les tests.
function dashboardConfig(patch = {}) {
  return {
    name: 'Demo dashboard',
    description: 'A small exported application.',
    themeId: 'sapphire',
    palette: { '--color-yellow': '#f5d547', '--color-violet': '#c4b1ff', '--color-black': '#0e0e12' },
    layoutKey: 'layout-demo',
    ...patch,
  }
}

test('dashboard : l’exécution réelle alimente les états, la sortie et le nœud courant', () => {
  const workspace = exampleWorkspace('gaugeDemo')
  const result = simulateProgram(workspace.project, { maxSteps: 20000 })
  assert.equal(result.ok, true)
  const widgets = dashboardWidgets(workspace.project, workspace.presentation.cards)
  const gauge = widgets.find((widget) => widget.type === 'gauge')
  assert.ok(gauge)
  const initial = dashboardInitialStates(widgets)
  assert.equal(initial.gauges[gauge.id].value, gauge.min)
  const states = dashboardStatesAt(result, result.trace.length - 1, initial)
  assert.equal(states.gauges[gauge.id].value, result.gauges[gauge.id].value)

  const nodes = dashboardNodeMap(workspace.project)
  const current = dashboardCurrentNode(result, 0, nodes)
  assert.equal(current.step, 1)
  assert.equal(current.total, result.trace.length)
  assert.ok(current.kind)
  const last = dashboardCurrentNode(result, result.trace.length - 1, nodes)
  assert.equal(last.step, result.trace.length)
})

test('dashboard : les commandes Run, Pause, Stop et l’avancement restent cohérents', () => {
  const result = { ok: true, trace: ['a', 'b', 'c'], output: [], outputSteps: [] }
  let state = dashboardExecutionReducer(dashboardExecutionInitial, { type: 'start' })
  assert.equal(state.status, 'preparing')
  state = dashboardExecutionReducer(state, { type: 'prepared', result })
  assert.equal(state.status, 'running')
  state = dashboardExecutionReducer(state, { type: 'tick', advance: 1 })
  assert.equal(state.index, 1)
  state = dashboardExecutionReducer(state, { type: 'pause' })
  assert.equal(state.status, 'paused')
  state = dashboardExecutionReducer(state, { type: 'tick', advance: 5 })
  assert.equal(state.index, 1, 'Pause conserve l’état visible')
  state = dashboardExecutionReducer(state, { type: 'resume' })
  assert.equal(state.status, 'running')
  state = dashboardExecutionReducer(state, { type: 'tick', advance: 5 })
  assert.equal(state.index, 2)
  assert.equal(state.status, 'completed')
  state = dashboardExecutionReducer(state, { type: 'stop' })
  assert.deepEqual(state, dashboardExecutionInitial)

  let paused = dashboardExecutionReducer(dashboardExecutionInitial, { type: 'start' })
  paused = dashboardExecutionReducer(paused, { type: 'pause' })
  paused = dashboardExecutionReducer(paused, { type: 'prepared', result })
  assert.equal(paused.status, 'paused')
  assert.equal(paused.result, result)

  const failed = dashboardExecutionReducer(dashboardExecutionInitial, { type: 'prepared', result: { ok: false, trace: [], errorCode: 'SIMULATION_DIAGNOSTICS' } })
  assert.equal(failed.status, 'error')
  assert.equal(failed.error, 'SIMULATION_DIAGNOSTICS')

  const withLayout = { ...dashboardExecutionInitial, layout: [{ id: 'panel', x: 0, y: 0, w: 1, h: 1, visible: true }], mode: 'light' }
  const started = dashboardExecutionReducer(withLayout, { type: 'start' })
  assert.equal(started.layout[0].id, 'panel')
  assert.equal(started.mode, 'light')
  const stopped = dashboardExecutionReducer({ ...started, result, status: 'running' }, { type: 'stop' })
  assert.equal(stopped.layout[0].id, 'panel')
  assert.equal(stopped.mode, 'light')
})

test('dashboard : cliquer la progression met en pause et revient au pas choisi', () => {
  const result = { ok: true, trace: ['a', 'b', 'c', 'd'], output: [], outputSteps: [] }
  let state = dashboardExecutionReducer(dashboardExecutionInitial, { type: 'prepared', result })
  state = dashboardExecutionReducer(state, { type: 'tick', advance: 2 })
  assert.equal(state.index, 2)
  state = dashboardExecutionReducer(state, { type: 'seek', index: 1 })
  assert.equal(state.status, 'paused')
  assert.equal(state.index, 1)
  assert.equal(state.result, result)
  assert.equal(dashboardExecutionReducer(state, { type: 'seek', index: 999 }).index, 3)
  assert.equal(dashboardExecutionReducer(state, { type: 'seek', index: -5 }).index, 0)
  assert.equal(dashboardExecutionReducer(dashboardExecutionInitial, { type: 'seek', index: 2 }), dashboardExecutionInitial)
})

test('dashboard : la lecture autonome boucle sans terminer', () => {
  assert.equal(dashboardNextIndex(4, 3, 1, true), 0)
  assert.equal(dashboardNextIndex(4, 2, 3, true), 1)
  assert.equal(dashboardNextIndex(4, 2, 3, false), 3)
  assert.equal(dashboardNextIndex(0, 2, 3, true), 0)
})

test('dashboard : la vitesse multiplie la cadence d’animation et reste bornée', () => {
  assert.equal(dashboardPlaybackRate(0, 1), 60)
  assert.equal(dashboardPlaybackRate(800, 1), 100)
  assert.equal(dashboardPlaybackRate(800, 2), 200)
  assert.equal(dashboardPlaybackRate(800, 3), 300)
  assert.equal(dashboardPlaybackRate(800, 0), 100)
  assert.equal(dashboardPlaybackRate(800, 999), 10000)
  assert.equal(dashboardPlaybackRate(3170, 1), 396.25)
})

test('dashboard : la sortie suit les pas réels et les images de widgets sont sélectionnées au bon index', () => {
  const result = {
    ok: true,
    trace: ['a', 'b', 'c', 'd', 'e', 'f'],
    output: ['one', 'two', 'three'],
    outputSteps: [1, 3, 5],
    gauges: { gauge: { value: 9, min: 0, max: 10 } },
    gaugeFrames: [
      { gauge: { value: 0, min: 0, max: 10 } },
      { gauge: { value: 4, min: 0, max: 10 } },
      { gauge: { value: 7, min: 0, max: 10 } },
    ],
    screens: { screen: { width: 1, height: 1, pixels: [9, 9, 9, 255] } },
    screenFrames: [
      { screen: { width: 1, height: 1, pixels: [1, 1, 1, 255] } },
      { screen: { width: 1, height: 1, pixels: [2, 2, 2, 255] } },
      { screen: { width: 1, height: 1, pixels: [3, 3, 3, 255] } },
    ],
  }
  assert.deepEqual(dashboardVisibleOutput(result, 0), ['one'])
  assert.deepEqual(dashboardVisibleOutput(result, 2), ['one', 'two'])
  assert.deepEqual(dashboardVisibleOutput(result, 4), ['one', 'two', 'three'])
  assert.deepEqual(dashboardVisibleOutput(result, 5), ['one', 'two', 'three'])

  const initial = { screens: {}, gauges: {}, leds: {}, rgbLeds: {}, progresses: {}, barCharts: {}, oscilloscopes: {}, heatmaps: {} }
  assert.equal(dashboardStatesAt(result, 0, initial).gauges.gauge.value, 0)
  assert.equal(dashboardStatesAt(result, 1, initial).gauges.gauge.value, 4)
  assert.equal(dashboardStatesAt(result, 5, initial).gauges.gauge.value, 9, 'la fin affiche l’état final')
  assert.deepEqual(dashboardStatesAt(result, 5, initial).screens.screen.pixels, [9, 9, 9, 255])
})

test('dashboard : les sept familles de widgets reçoivent un état initial sans exécuter le programme', () => {
  const widgets = [
    { id: 'screen', type: 'screen', name: 'Screen', width: 2, height: 2 },
    { id: 'led', type: 'led', name: 'LED', value: true },
    { id: 'rgb', type: 'rgbLed', name: 'RGB', red: 10, green: 20, blue: 30 },
    { id: 'gauge', type: 'gauge', name: 'Gauge', min: 5, max: 15 },
    { id: 'progress', type: 'progress', name: 'Progress', min: 2, max: 8 },
    { id: 'bars', type: 'barChart', name: 'Bars', size: 3 },
    { id: 'scope', type: 'oscilloscope', name: 'Scope', samples: 4 },
    { id: 'heat', type: 'heatmap', name: 'Heat', width: 2, height: 2 },
  ]
  const states = dashboardInitialStates(widgets)
  assert.equal(states.screens.screen.pixels.length, 16)
  assert.equal(states.screens.screen.pixels.every((value) => value === 0), true)
  assert.deepEqual(states.leds.led, { value: true })
  assert.deepEqual(states.rgbLeds.rgb, { red: 10, green: 20, blue: 30 })
  assert.deepEqual(states.gauges.gauge, { value: 5, min: 5, max: 15 })
  assert.deepEqual(states.progresses.progress, { value: 2, min: 2, max: 8 })
  assert.deepEqual(states.barCharts.bars, { values: [0, 0, 0] })
  assert.deepEqual(states.oscilloscopes.scope, { xMin: -10, xMax: 10, samples: 4, revision: 0, channels: [] })
  assert.deepEqual(states.heatmaps.heat, { width: 2, height: 2, values: [0, 0, 0, 0] })
})

test('dashboard : un oscilloscope reçoit ses canaux au pas courant', () => {
  const frame = (value) => ({ scope: { xMin: 0, xMax: 1, samples: 2, revision: 1, channels: [{ id: 1, values: [value, value] }] } })
  const result = {
    ok: true,
    trace: ['a', 'b', 'c'],
    output: [],
    outputSteps: [],
    oscilloscopes: { scope: frame(2).scope },
    oscilloscopeFrames: [frame(0), frame(1), frame(2)],
  }
  const initial = dashboardInitialStates([{ id: 'scope', type: 'oscilloscope', name: 'Scope', samples: 2 }])
  assert.deepEqual(dashboardStatesAt(result, 0, initial).oscilloscopes.scope.channels[0].values, [0, 0])
  assert.deepEqual(dashboardStatesAt(result, 1, initial).oscilloscopes.scope.channels[0].values, [1, 1])
  assert.deepEqual(dashboardStatesAt(result, 2, initial).oscilloscopes.scope.channels[0].values, [2, 2])
})

test('dashboard : la palette est extraite, validée et dérivée en variante claire', () => {
  const palette = dashboardPaletteFromTheme({
    '--color-yellow': '#F5D547',
    '--color-black': '#0E0E12',
    '--color-text': 'red',
    '--unknown-token': '#ffffff',
  })
  assert.deepEqual(palette, { '--color-black': '#0e0e12', '--color-yellow': '#f5d547' })
  assert.equal(resolveDashboardPalette({ ...defaultDashboardConfig(), palette }, [])['--color-yellow'], '#f5d547')
  assert.equal(resolveDashboardPalette({ ...defaultDashboardConfig(), palette: null, themeId: 'custom' }, [{ id: 'custom', colors: { '--color-yellow': '#abcdef' } }])['--color-yellow'], '#abcdef')
  assert.doesNotThrow(() => assertDashboardConfig(dashboardConfig()))
  assert.throws(() => assertDashboardConfig(dashboardConfig({ name: 'x'.repeat(81) })), { code: 'DASHBOARD_CONFIG_INVALID' })
  assert.throws(() => assertDashboardConfig(dashboardConfig({ palette: { '--color-yellow': 'red' } })), { code: 'DASHBOARD_CONFIG_INVALID' })

  const css = dashboardThemeCss({ '--color-black': '#101014', '--color-yellow': '#f5d547' })
  assert.match(css, /:root\[data-mode="dark"\]/)
  assert.match(css, /:root\[data-mode="light"\]/)
  assert.match(css, /--color-black:#f2f4f7/)
  assert.match(css, /--color-yellow:/)

  const fontCss = dashboardFontCss({ interLatin: 'data:font/woff2;base64,AAAA' })
  assert.match(fontCss, /@font-face/)
  assert.match(fontCss, /font-family:'Inter'/)
  assert.match(fontCss, /data:font\/woff2;base64,AAAA/)
  assert.equal(dashboardFontCss({ interLatin: 'https://example.test/font.woff2' }), '')
})

test('dashboard : déplacement, redimensionnement, masquage et disposition responsive sont bornés', () => {
  const panels = [
    { id: 'a', w: 6, h: 4 },
    { id: 'b', w: 6, h: 4 },
    { id: 'c', w: 12, h: 2 },
  ]
  let layout = packDashboardLayout(panels)
  assert.equal(layout.length, 3)
  assert.deepEqual({ x: layout[0].x, y: layout[0].y }, { x: 0, y: 0 })
  assert.deepEqual({ x: layout[1].x, y: layout[1].y }, { x: 6, y: 0 })
  assert.deepEqual({ x: layout[2].x, y: layout[2].y }, { x: 0, y: 4 })
  layout = moveDashboardPanel(layout, 'a', -20, 2)
  assert.deepEqual({ x: layout[0].x, y: layout[0].y }, { x: 0, y: 2 })
  layout = resizeDashboardPanel(layout, 'a', 20, 20)
  assert.equal(layout[0].w, dashboardColumns)
  assert.ok(layout[0].h >= 2)
  layout = toggleDashboardPanel(layout, 'a', false)
  assert.equal(layout[0].visible, false)
  layout = toggleDashboardPanel(layout, 'a', true)
  assert.equal(layout[0].visible, true)
  const scaled = scaleDashboardLayout(layout, 6)
  assert.equal(scaled[0].w, 6)
  assert.equal(scaled[0].x, 0)

  const storageMap = new Map()
  const storage = { getItem: (key) => storageMap.get(key) ?? null, setItem: (key, value) => storageMap.set(key, value) }
  assert.equal(writeDashboardLayout(storage, dashboardLayoutStorageKey('demo'), layout), true)
  assert.deepEqual(readDashboardLayout(storage, dashboardLayoutStorageKey('demo'), [], panels), layout)
  storage.setItem('broken', '{')
  assert.deepEqual(readDashboardLayout(storage, 'broken', ['fallback'], panels), ['fallback'])
  storage.setItem('stale', JSON.stringify([...layout, { id: 'unknown', x: 0, y: 0, w: 1, h: 1, visible: true }]))
  assert.equal(readDashboardLayout(storage, 'stale', [], panels).some((entry) => entry.id === 'unknown'), false)
})

test('dashboard : la disposition initiale inclut les widgets, la sortie et l’exécution', () => {
  const workspace = exampleWorkspace('gaugeDemo')
  const widgets = dashboardWidgets(workspace.project, workspace.presentation.cards)
  const layout = dashboardDefaultLayout(widgets)
  assert.equal(layout.length, widgets.length + 2)
  assert.ok(layout.some((entry) => entry.id === 'sapphire:dashboard:output'))
  assert.ok(layout.some((entry) => entry.id === 'sapphire:dashboard:execution'))
  assert.equal(normalizeDashboardLayout(layout, widgets.map((widget) => ({ id: widget.id, w: 4, h: 4 }))).length, widgets.length)
})

test('dashboard : l’export produit un HTML unique, échappé, hors ligne et thémé', () => {
  const workspace = exampleWorkspace('gaugeDemo')
  const widgets = dashboardWidgets(workspace.project, workspace.presentation.cards)
  const labels = dashboardLabels((key, values) => translate('en', key, values))
  const html = buildDashboardDocument({
    name: '<Demo> & "Test"',
    description: 'A & B < C',
    palette: { '--color-black': '#101014', '--color-anthracite': '#19191f', '--color-anthracite-raised': '#24242c', '--color-text': '#f2f1f6', '--color-yellow': '#f5d547', '--color-violet': '#c4b1ff' },
    widgets,
    initialStates: dashboardInitialStates(widgets),
    layout: dashboardDefaultLayout(widgets),
    layoutKey: 'layout-demo',
    runtimeSource: 'window.SapphireDashboardRuntime = { simulate: function () { return { ok: true, trace: [] } } };',
    clientSource: '/* dashboard client */',
    labels,
    kindLabels: { PrintStatement: 'Print' },
    project: workspace.project,
    language: 'en',
    fonts: { interLatin: 'data:font/woff2;base64,AAAA' },
    branding: { logo: 'data:image/webp;base64,AAAA' },
    version: '0.1.0-test',
    repository: 'https://github.com/lalBi94/Sapphire3',
  })
  assert.match(html, /<title>&lt;Demo&gt; &amp; &quot;Test&quot;<\/title>/)
  assert.match(html, /A &amp; B &lt; C/)
  assert.match(html, /data-mode="dark"/)
  assert.match(html, /:root\[data-mode="light"\]/)
  assert.match(html, /#f2f4f7/)
  assert.match(html, /sapphire-dashboard-runtime/)
  assert.match(html, /sapphire-dashboard-client/)
  assert.match(html, /@font-face/)
  assert.match(html, /data:font\/woff2;base64,AAAA/)
  assert.match(html, /data:image\/webp;base64,AAAA/)
  assert.match(html, /Threadlock Systems/)
  assert.match(html, /Sapphire 3/)
  assert.match(html, /db-footer__logo/)
  assert.match(html, /db-footer__version/)
  assert.match(html, /v0\.1\.0-test/)
  assert.match(html, /db-github/)
  assert.match(html, /https:\/\/github\.com\/lalBi94\/Sapphire3/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /data-speed-slider/)
  assert.match(html, /data-speed-value/)
  assert.match(html, /data-speed-slider[^>]*max="100"/)
  assert.match(html, /data-language-select/)
  assert.match(html, /data-language-label/)
  assert.match(html, /<option value="en" selected>English<\/option>/)
  assert.match(html, /Français/)
  assert.match(html, /data-progress-track/)
  assert.match(html, /type="range"/)
  assert.match(html, /db-button__icon/)
  assert.match(html, /data-run-label/)
  assert.match(html, /data-action="autonomous"/)
  assert.match(html, /data-feedback/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /object-fit: cover/)
  assert.match(html, /\.db-panel--screen \.db-panel__body/)
  assert.match(html, /"layoutKey":"layout-demo"/)
  assert.match(html, /"widgets":/)
  assert.match(html, /"initialStates":/)
  assert.match(html, /"translations":/)
  assert.match(html, /"languages":/)
  assert.doesNotMatch(html, /<(?:script|link|img|source|iframe)[^>]+(?:src|href)="https?:/i)
  assert.doesNotMatch(html, /url\(\s*['"]?https?:/i)
  assert.doesNotMatch(html, /<link\b/i)
  assert.doesNotMatch(html, /src="(?:https?:)?\/\//i)
  assert.doesNotMatch(html, /workspace\.sp3/)
  assert.doesNotMatch(html, /"presentation":/)
  assert.doesNotMatch(html, /"cards":/)
  assert.doesNotMatch(html, /Neutralino/)
  assert.equal(escapeDashboardHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  assert.equal(safeInlineScript('const value = "</script>"'), 'const value = "<\\/script>"')
  assert.equal(serializeDashboardJson({ value: '</script>' }), '{"value":"\\u003c/script\\u003e"}')
})

test('dashboard : la configuration d’export survit au workspace et les valeurs invalides sont refusées', () => {
  const workspace = exampleWorkspace('gaugeDemo')
  const config = dashboardConfig()
  const camera = { x: 0, y: 0, zoomLevel: 0 }
  const text = serializeWorkspace(workspace.project, workspace.presentation.cards, camera, null, null, config)
  const roundTrip = deserializeWorkspace(text)
  assert.deepEqual(roundTrip.dashboard, config)

  const invalid = JSON.parse(text)
  invalid.dashboard = { ...config, palette: { '--color-yellow': 'not-a-color' } }
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)), { code: 'DASHBOARD_CONFIG_INVALID' })
  assert.throws(() => serializeWorkspace(workspace.project, workspace.presentation.cards, camera, null, null, { ...config, layoutKey: 42 }), { code: 'DASHBOARD_CONFIG_INVALID' })
})

test('dashboard : le document initial et le remplacement de workspace conservent la configuration', () => {
  const base = initialDocument()
  assert.deepEqual(base.dashboard, defaultDashboardConfig())
  const config = dashboardConfig({ name: 'Persisted' })
  const replaced = reduceDocument(base, { type: 'replaceWorkspace', workspace: { project: base.project, presentation: { cards: [] }, dashboard: config } })
  assert.deepEqual(replaced.dashboard, config)
  const updated = reduceDocument(replaced, { type: 'dashboard', dashboard: { ...config, description: 'Updated' } })
  assert.equal(updated.dashboard.description, 'Updated')
  assert.equal(updated.dashboard.name, 'Persisted')
})
