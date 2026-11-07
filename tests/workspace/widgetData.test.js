import test from 'node:test'
import assert from 'node:assert/strict'
import { barChartRows, heatmapRows } from '../../src/utils/widgetData.js'

test('graphique à barres : positions accessibles dans l’ordre affiché', () => {
  assert.deepEqual(barChartRows([4, -2, 0]), [
    { position: 1, value: 4 },
    { position: 2, value: -2 },
    { position: 3, value: 0 },
  ])
  assert.deepEqual(barChartRows([]), [])
  assert.deepEqual(barChartRows(null), [])
})

test('carte thermique : coordonnées accessibles ligne par ligne', () => {
  assert.deepEqual(heatmapRows([1, 2, 3, 4, 5], 2), [
    { row: 1, column: 1, value: 1 },
    { row: 1, column: 2, value: 2 },
    { row: 2, column: 1, value: 3 },
    { row: 2, column: 2, value: 4 },
    { row: 3, column: 1, value: 5 },
  ])
  assert.deepEqual(heatmapRows([], 3), [])
  assert.deepEqual(heatmapRows([1, 2], 0), [])
  assert.deepEqual(heatmapRows([1, 2], 1.5), [])
  assert.deepEqual(heatmapRows(null, 2), [])
})
