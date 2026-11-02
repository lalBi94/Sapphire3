import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutModules } from '../../src/utils/moduleLayout.js'

// Fabrique une carte Module minimale pour le placement.
function card(id, x, y, width = 320, height = 220) {
  return { id, type: 'module', x, y, width, height }
}

test('placement des modules : fournisseurs à gauche, utilisateurs à droite', () => {
  const modules = [card('consumer', 500, 40), card('provider', 20, 700), card('isolated', 900, 900)]
  const positions = layoutModules(modules, [{ fromId: 'provider', toId: 'consumer' }], { horizontal: 100, vertical: 50 })
  assert.deepEqual(positions.provider, { x: 20, y: 40 })
  assert.deepEqual(positions.consumer, { x: 20 + 320 + 100, y: 40 })
  assert.equal(positions.isolated.x, positions.provider.x)
})

test('placement des modules : profondeur d’un losange et ordre stable dans une colonne', () => {
  const modules = [card('root', 0, 0), card('left', 10, 10), card('right', 20, 20), card('join', 30, 30)]
  const links = [
    { fromId: 'root', toId: 'left' },
    { fromId: 'root', toId: 'right' },
    { fromId: 'left', toId: 'join' },
    { fromId: 'right', toId: 'join' },
  ]
  const positions = layoutModules(modules, links)
  assert.equal(positions.root.x, 0)
  assert.equal(positions.left.x, 400)
  assert.equal(positions.right.x, 400)
  assert.deepEqual(positions.join.x, 800)
  assert.equal(positions.left.y, 0)
  assert.equal(positions.right.y, 276)
  assert.equal(positions.join.y, 0)
})

test('placement des modules : cycle d’imports et liens invalides sans blocage', () => {
  const modules = [card('a', 5, 5, 200, 100), card('b', 40, 60, 400, 150)]
  const positions = layoutModules(modules, [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'a' },
    { fromId: 'a', toId: 'a' },
    { fromId: 'a', toId: 'missing' },
    null,
  ], { horizontal: 10, vertical: 10 })
  assert.deepEqual(positions, { a: { x: 5, y: 5 }, b: { x: 5 + 200 + 10, y: 5 } })
  assert.deepEqual(layoutModules([], []), {})
})

test('placement des modules : largeur de colonne alignée sur le module le plus large', () => {
  const modules = [card('wide', 0, 0, 600, 100), card('narrow', 0, 200, 200, 100), card('next', 0, 400, 200, 100)]
  const positions = layoutModules(modules, [{ fromId: 'wide', toId: 'next' }], { horizontal: 50, vertical: 20 })
  assert.equal(positions.narrow.x, 0)
  assert.equal(positions.narrow.y, 120)
  assert.equal(positions.next.x, 650)
})
