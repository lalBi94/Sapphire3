import test from 'node:test'
import assert from 'node:assert/strict'
import { snapModuleRect } from '../../src/utils/moduleSnap.js'

const moving = { x: 100, y: 100, width: 200, height: 100 }

test('moduleSnap : aligne le bord gauche sur un voisin proche', () => {
  const result = snapModuleRect(moving, [{ x: 104, y: 400, width: 80, height: 40 }], 8)
  assert.equal(result.x, 104)
  assert.equal(result.y, 100)
  assert.deepEqual(result.guides.vertical, [104])
  assert.deepEqual(result.guides.horizontal, [])
})

test('moduleSnap : aligne les centres, les bords droits et les hauteurs', () => {
  const result = snapModuleRect(moving, [{ x: 300, y: 203, width: 100, height: 50 }], 8)
  assert.equal(result.x, 100)
  assert.equal(result.y, 103)
  assert.deepEqual(result.guides.vertical, [300])
  assert.deepEqual(result.guides.horizontal, [203])
  assert.equal(result.x + moving.width, 300)
  assert.equal(result.y + moving.height, 203)
})

test('moduleSnap : choisit le repère le plus proche et ignore les voisins lointains', () => {
  const result = snapModuleRect(moving, [
    { x: 306, y: 300, width: 100, height: 50 },
    { x: 102, y: 300, width: 100, height: 50 },
  ], 8)
  assert.equal(result.x, 102)
  assert.equal(result.y, 100)
  assert.deepEqual(result.guides.vertical, [102])
})

test('moduleSnap : aucun déplacement lorsque le seuil est dépassé', () => {
  const result = snapModuleRect(moving, [{ x: 120, y: 120, width: 40, height: 40 }], 8)
  assert.equal(result.x, moving.x)
  assert.equal(result.y, moving.y)
  assert.deepEqual(result.guides, { vertical: [], horizontal: [] })
})
