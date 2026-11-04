import test from 'node:test'
import assert from 'node:assert/strict'
import { findFrameCycle } from '../../src/utils/screenPlayback.js'

// Construit une image d'écran minimale à partir d'une valeur, pour tester les cycles.
function frame(screenId, value) {
  return { [screenId]: { width: 2, height: 1, pixels: [value, 0, 0, 255, value, 0, 0, 255] } }
}

test('lecture d’écran : une séquence périodique est détectée', () => {
  const frames = [frame('s', 1), frame('s', 2), frame('s', 3), frame('s', 1), frame('s', 2), frame('s', 3)]
  assert.equal(findFrameCycle(frames, 's'), 3)
})

test('lecture d’écran : une séquence constante a une période de 1', () => {
  const frames = [frame('s', 5), frame('s', 5), frame('s', 5)]
  assert.equal(findFrameCycle(frames, 's'), 1)
})

test('lecture d’écran : une séquence non périodique ne renvoie aucune période', () => {
  const frames = [frame('s', 1), frame('s', 2), frame('s', 3), frame('s', 4), frame('s', 5)]
  assert.equal(findFrameCycle(frames, 's'), 0)
})

test('lecture d’écran : entrées invalides ou absentes ignorées', () => {
  assert.equal(findFrameCycle(null, 's'), 0)
  assert.equal(findFrameCycle([frame('s', 1)], 's'), 0)
  assert.equal(findFrameCycle([frame('s', 1), frame('s', 1)], 'missing'), 1)
  assert.equal(findFrameCycle([frame('s', 1), frame('s', 1)], null), 0)
})
