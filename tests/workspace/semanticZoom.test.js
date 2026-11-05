import test from 'node:test'
import assert from 'node:assert/strict'
import { semanticZoomLevel, semanticZoomThresholds, semanticDetailZoomLevel, semanticSearchZoomLevel } from '../../src/utils/semanticZoom.js'

test('zoom sémantique : instructions, fonctions puis relations entre modules', () => {
  assert.equal(semanticZoomLevel(2), 'detail')
  assert.equal(semanticZoomLevel(1), 'detail')
  assert.equal(semanticZoomLevel(0.8), 'detail')
  assert.equal(semanticZoomLevel(0.211), 'detail')
  assert.equal(semanticZoomLevel(semanticZoomThresholds.detail), 'functions')
  assert.equal(semanticZoomLevel(0.15), 'functions')
  assert.equal(semanticZoomLevel(0.101), 'functions')
  assert.equal(semanticZoomLevel(semanticZoomThresholds.modules), 'modules')
  assert.equal(semanticZoomLevel(0.05), 'modules')
  assert.equal(semanticZoomLevel(Number.NaN), 'detail')
  assert.equal(semanticDetailZoomLevel, Math.log2(semanticZoomThresholds.detail))
  assert.equal(semanticSearchZoomLevel, Math.log2(0.8))
})
