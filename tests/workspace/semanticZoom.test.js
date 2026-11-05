import test from 'node:test'
import assert from 'node:assert/strict'
import { semanticZoomLevel, semanticZoomThresholds, semanticDetailZoomLevel } from '../../src/utils/semanticZoom.js'

test('zoom sémantique : instructions, fonctions puis relations entre modules', () => {
  assert.equal(semanticZoomLevel(2), 'detail')
  assert.equal(semanticZoomLevel(1), 'detail')
  assert.equal(semanticZoomLevel(semanticZoomThresholds.detail), 'detail')
  assert.equal(semanticZoomLevel(0.79), 'functions')
  assert.equal(semanticZoomLevel(0.5), 'functions')
  assert.equal(semanticZoomLevel(0.46), 'functions')
  assert.equal(semanticZoomLevel(semanticZoomThresholds.modules), 'modules')
  assert.equal(semanticZoomLevel(0.2), 'modules')
  assert.equal(semanticZoomLevel(Number.NaN), 'detail')
  assert.equal(semanticDetailZoomLevel, Math.log2(semanticZoomThresholds.detail))
})
