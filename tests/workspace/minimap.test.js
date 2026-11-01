import test from 'node:test'
import assert from 'node:assert/strict'
import { minimapLayout } from '../../src/utils/minimap.js'

const modules = [
  { id: 'a', x: 0, y: 0, width: 400, height: 300 },
  { id: 'b', x: 800, y: 400, width: 400, height: 300 },
]

test('mini-carte : projection monde <-> pixels cohérente', () => {
  const layout = minimapLayout({ modules, camera: { x: 400, y: 200 }, zoom: 1, viewport: { width: 800, height: 600 }, width: 184, height: 128 })
  assert.ok(layout.scale > 0)
  for (const world of [0, 400, 1200, -200]) {
    const roundTrip = layout.toWorldX(layout.toPxX(world))
    assert.ok(Math.abs(roundTrip - world) < 1e-6, `aller-retour X pour ${world}`)
  }
  assert.ok(Math.abs(layout.toWorldY(layout.toPxY(400)) - 400) < 1e-6)
})

test('mini-carte : le contenu englobe les modules et la vue, même caméra éloignée', () => {
  const far = minimapLayout({ modules, camera: { x: 5000, y: 5000 }, zoom: 1, viewport: { width: 800, height: 600 }, width: 184, height: 128 })
  assert.ok(far.bounds.right >= 5000, 'la vue éloignée est incluse')
  assert.ok(far.bounds.left <= 0, 'les modules restent inclus')
  const empty = minimapLayout({ modules: [], camera: { x: 0, y: 0 }, zoom: 1, viewport: { width: 0, height: 0 }, width: 184, height: 128 })
  assert.ok(Number.isFinite(empty.scale) && empty.scale > 0, 'aucune division par zéro sans module ni vue')
})

test('mini-carte : un zoom nul ne divise pas par zéro', () => {
  const layout = minimapLayout({ modules, camera: { x: 0, y: 0 }, zoom: 0, viewport: { width: 800, height: 600 }, width: 184, height: 128 })
  assert.ok(Number.isFinite(layout.view.left) && Number.isFinite(layout.view.right))
})
