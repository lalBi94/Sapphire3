import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLinkLayer } from '../../src/utils/canvasLinks.js'

const cards = [
  { id: 'math', type: 'module', x: 0, y: 0, width: 520, height: 200 },
  { id: 'app', type: 'module', x: 900, y: 420, width: 520, height: 300 },
  { id: 'note', type: 'comment', x: 300, y: 300, width: 120, height: 80 },
]

const link = { id: 'math::app', fromId: 'math', toId: 'app', fromName: 'math', toName: 'app', exports: [{ nodeId: 'answer', name: 'answer', localName: 'answer', uses: 1 }] }

test('couche de liens : une courbe cubique relie deux cartes modules en coordonnées monde', () => {
  const layer = buildLinkLayer(cards, [link])
  assert.equal(layer.edges.length, 1)
  const [edge] = layer.edges
  assert.match(edge.d, /^M[\d.-]+ [\d.-]+ C/)
  // Le module de gauche est plus haut : la flèche sort par la droite et entre par la gauche du récepteur.
  assert.ok(edge.link === link)
  assert.ok(edge.x > 0 && edge.x < 1420)
})

test('couche de liens : le cadre englobre les modules et la marge rend les flèches visibles', () => {
  const layer = buildLinkLayer(cards, [link])
  assert.ok(layer.left <= -96 && layer.top <= -96)
  assert.ok(layer.width >= 1420 + 192 && layer.height >= 720 + 192)
})

test('couche de liens : aucun lien sans carte module ou écran visible ne dessine quoi que ce soit', () => {
  assert.equal(buildLinkLayer(cards, []), null)
  assert.equal(buildLinkLayer(cards, [{ ...link, toId: 'missing' }]), null)
  assert.equal(buildLinkLayer(cards.filter((card) => !['module', 'screen'].includes(card.type)), [link]), null)
  assert.equal(buildLinkLayer(undefined, undefined), null)
})

test('couche de liens : une carte écran participe aux flèches comme son module caché', () => {
  const screenCards = [
    { id: 'screenOne', type: 'screen', x: 0, y: 0, width: 240, height: 160 },
    { id: 'patterns', type: 'module', x: 700, y: 0, width: 520, height: 300 },
  ]
  const screenLink = { id: 'screenOne::patterns', fromId: 'screenOne', toId: 'patterns', fromName: 'Screen one', toName: 'Screen patterns', exports: [{ nodeId: 'set', name: 'SCREEN_SP3_SET_PIXEL_1', localName: 'setOne', uses: 2 }] }
  const layer = buildLinkLayer(screenCards, [screenLink])
  assert.equal(layer.edges.length, 1)
  assert.ok(layer.edges[0].x > 0 && layer.edges[0].x < 1220)
})
