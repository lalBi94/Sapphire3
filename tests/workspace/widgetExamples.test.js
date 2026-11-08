import test from 'node:test'
import assert from 'node:assert/strict'
import { examples } from '../../src/utils/examples.js'
import { widgetExamples } from '../../src/utils/widgetExamples.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'

// Valide le vrai workspace importable avant de tester le résultat calculé par son point d'entrée.
function run(id) {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === id).build()))
  const before = JSON.stringify(workspace)
  assert.deepEqual(analyzeProgram(workspace.project).diagnostics, [], id)
  const result = simulateProgram(workspace.project)
  assert.equal(result.ok, true, `${id}: ${result.errorCode ?? ''}`)
  assert.ok(result.steps < 10000, `${id}: budget borné`)
  assert.equal(JSON.stringify(workspace), before, `${id}: source non mutée`)
  return result
}

test('difficultés : reclassifications pédagogiques et onze ajouts distincts', () => {
  assert.equal(widgetExamples.length, 11)
  assert.equal(examples.length, 64)
  assert.equal(new Set(examples.map((entry) => entry.id)).size, 64)
  const expected = {
    gaugeDemo: 'simple', fibonacci: 'medium', recursion: 'medium', sorting: 'medium',
    quickSort: 'hard', coinChange: 'hard', trafficControl: 'medium', dnaAnalyzer: 'medium', collatzAtlas: 'medium',
    heatDiffusion: 'hard', imageConvolution: 'hard', coral: 'hard', starfield: 'hard',
  }
  for (const [id, category] of Object.entries(expected)) assert.equal(examples.find((entry) => entry.id === id).category, category, id)
  assert.deepEqual(['simple', 'medium', 'hard'].map((category) => examples.filter((entry) => entry.category === category).length), [8, 32, 24])
})

test('chaque nouvel exemple mélange un algorithme réel avec plusieurs widgets et leur historique', () => {
  for (const entry of widgetExamples) {
    const workspace = examples.find((example) => example.id === entry.id).build()
    const cards = workspace.presentation.cards.filter((card) => !['module', 'comment', 'class'].includes(card.type))
    assert.ok(cards.length >= 2, entry.id)
    assert.equal(workspace.presentation.cards.filter((card) => card.type === 'module').length, 1, entry.id)
    const result = run(entry.id)
    for (const card of cards) {
      const stateField = { barChart: 'barCharts', heatmap: 'heatmaps', gauge: 'gauges', progress: 'progresses', led: 'leds', rgbLed: 'rgbLeds' }[card.type]
      const frameField = { barChart: 'barChartFrames', heatmap: 'heatmapFrames', gauge: 'gaugeFrames', progress: 'progressFrames', led: 'ledFrames', rgbLed: 'rgbLedFrames' }[card.type]
      assert.ok(result[stateField][card.id], `${entry.id}: état ${card.id}`)
      const states = new Set(result[frameField].map((frame) => JSON.stringify(frame[card.id])))
      assert.ok(states.size > 1, `${entry.id}: widget réellement piloté ${card.id}`)
    }
  }
})

test('Euclide et dichotomie : résultats et témoins lumineux', () => {
  const gcd = run('euclid')
  assert.deepEqual(gcd.output, ['21'])
  assert.deepEqual(gcd.barCharts.euclidBars.values, [21, 0])
  assert.equal(gcd.leds.euclidDone.value, true)
  const search = run('binarySearch')
  assert.deepEqual(search.output, ['6'])
  assert.deepEqual(search.rgbLeds.searchLed, { red: 0, green: 255, blue: 0 })
  assert.deepEqual(search.barCharts.searchBars.values, [0, 0, 0, 0, 24, 31, 42, 55, 0, 0])
})

test('crible et tri par insertion : tous les nombres et toutes les cases sont vérifiés', () => {
  const sieve = run('primeSieve')
  const expectedPrimes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31])
  assert.deepEqual(sieve.heatmaps.primeHeat.values, Array.from({ length: 32 }, (_, index) => expectedPrimes.has(index) ? 100 : 0))
  assert.equal(sieve.progresses.primeProgress.value, 100)
  const sort = run('insertionSort')
  assert.deepEqual(sort.barCharts.insertionBars.values, [1, 2, 3, 4, 6, 7, 8, 9])
  assert.equal(sort.progresses.insertionProgress.value, 100)
})

test('histogramme de dé : tirages reproductibles et compte total conservé', () => {
  const counts = Array(6).fill(0)
  let seed = 7
  for (let index = 0; index < 48; index += 1) { seed = (17 * seed + 43) % 97; counts[seed % 6] += 1 }
  const result = run('diceHistogram')
  assert.deepEqual(result.barCharts.diceBars.values, counts)
  assert.equal(counts.reduce((total, value) => total + value, 0), 48)
  assert.equal(result.progresses.diceProgress.value, 100)
})

test('file et thermostat : histoires, états et seuils observables', () => {
  const queue = run('checkoutQueue')
  assert.deepEqual(queue.barCharts.queueBars.values, [1, 0, 2, 0, 0, 3, 2, 0, 1, 1, 0, 0])
  assert.equal(queue.gauges.queueGauge.value, 0)
  assert.equal(queue.leds.queueLed.value, false)
  assert.ok(queue.ledFrames.some((frame) => frame.queueLed?.value === true))
  const thermostat = run('thermostat')
  const temperatures = thermostat.barCharts.thermoBars.values
  const finalTemperature = temperatures.at(-1)
  assert.ok(Number.isInteger(finalTemperature) && finalTemperature >= 15 && finalTemperature <= 30)
  assert.ok(temperatures.every((value) => value >= 15 && value <= 30))
  assert.equal(thermostat.gauges.thermoGauge.value, finalTemperature)
  assert.ok(thermostat.ledFrames.some((frame) => frame.thermoLed?.value === false))
  assert.ok(thermostat.ledFrames.some((frame) => frame.thermoLed?.value === true))
})

test('ressort amorti : calcul indépendant en doubles et historique signé', () => {
  const result = run('dampedSpring')
  const values = result.barCharts.springBars.values
  assert.equal(values.length, 24)
  assert.ok(values.every(Number.isFinite))
  assert.ok(values.some((value) => value < 0) && values.some((value) => value > 0))
  assert.ok(Math.abs(result.gauges.springGauge.value) < 20)
})

test('remplissage et Pascal : grille complète et mise à jour inverse correcte', () => {
  const fill = run('floodFill')
  assert.deepEqual(fill.output, ['21'])
  const cells = fill.heatmaps.floodHeat.values
  assert.equal(cells.filter((value) => value === 100).length, 21)
  assert.equal(cells.filter((value) => value === 20).length, 27)
  assert.equal(fill.progresses.floodProgress.value, 100)
  const pascal = run('pascalTriangle')
  assert.deepEqual(pascal.barCharts.pascalBars.values, [1, 7, 21, 35, 35, 21, 7, 1])
  for (let row = 0; row < 8; row += 1) assert.equal(pascal.heatmaps.pascalHeat.values.slice(row * 8, row * 8 + 8).reduce((sum, value) => sum + value, 0), 2 ** row)
})
