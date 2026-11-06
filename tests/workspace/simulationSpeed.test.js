import test from 'node:test'
import assert from 'node:assert/strict'
import { clampSimulationSpeed, simulationTargetStep } from '../../src/utils/simulationSpeed.js'

test('vitesse de simulation : bornage des valeurs saisies', () => {
  assert.equal(clampSimulationSpeed(0), 1)
  assert.equal(clampSimulationSpeed(-3), 1)
  assert.equal(clampSimulationSpeed(3.6), 4)
  assert.equal(clampSimulationSpeed(999), 100)
  assert.equal(clampSimulationSpeed('abc'), 1)
})

test('vitesse de simulation : progression temporelle et bornes de trace', () => {
  assert.equal(simulationTargetStep(0, 0, 1, 100), 0)
  assert.equal(simulationTargetStep(0, 419, 1, 100), 0)
  assert.equal(simulationTargetStep(0, 420, 1, 100), 1)
  assert.equal(simulationTargetStep(0, 420, 2, 100), 2)
  assert.equal(simulationTargetStep(0, 140, 3, 100), 1)
  assert.equal(simulationTargetStep(10, 420, 10, 100), 20)
  assert.equal(simulationTargetStep(95, 420, 10, 100), 99)
  assert.equal(simulationTargetStep(0, 420, 1, 1), 0)
})
