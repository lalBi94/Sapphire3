import test from 'node:test'
import assert from 'node:assert/strict'
import { createRgbLedModule } from '../../src/utils/rgbLedNode.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { buildLinkLayer } from '../../src/utils/canvasLinks.js'

const type = 'rgbLed'
const factory = createRgbLedModule

// Carte de présentation minimale pour la LED RVB de test.
function rgbCard(overrides = {}) {
  return { id: 'rgb', type, name: 'RGB', x: 0, y: 0, width: moduleTypes.rgbLed.width, height: moduleTypes.rgbLed.height, expandedNodeIds: [], ...overrides }
}

test('rgbLed : création, renommage, suppression et undo/redo', () => {
  const widget = factory('rgb', 'RGB', 1)
  let history = { past: [], present: initialDocument(), future: [] }
  history = reduceHistory(history, { type: 'createRgbLed', card: rgbCard(), rgbLed: widget })
  assert.equal(history.present.project.modules.length, 1)
  assert.equal(history.present.cards[0].type, type)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards.length, 0)
  history = reduceHistory(history, { type: 'redo' })
  const renamed = reduceDocument(history.present, { type: 'rename', id: 'rgb', name: 'Renamed' })
  assert.equal(renamed.project.modules[0].name, 'Renamed')
  assert.equal(reduceDocument(renamed, { type: 'deleteModule', id: 'rgb' }).cards.length, 0)
})

test('rgbLed : vues, nœuds dépliés et source seule conservés', () => {
  const widget = factory('rgb', 'RGB', 1)
  const project = { ...initialDocument().project, modules: [widget.module], nodes: widget.nodes }
  const card = rgbCard({ expandedNodeIds: [widget.module.rootNodeIds[0]], rgbLedView: 'code' })
  const text = serializeWorkspace(project, [card], { x: 0, y: 0, zoomLevel: 0 })
  const workspace = deserializeWorkspace(text)
  assert.deepEqual(workspace.presentation.cards[0], card)
  assert.equal(deserializeWorkspace(JSON.stringify(project)).presentation.cards[0].type, type)
  assert.throws(() => serializeWorkspace(project, [rgbCard({ rgbLedView: 'invalid' })], workspace.presentation.camera))
  assert.throws(() => serializeWorkspace(project, [rgbCard({ id: 'missing' })], workspace.presentation.camera))
  const defaults = JSON.parse(serializeWorkspace(project, [rgbCard({ rgbLedView: type })], workspace.presentation.camera))
  assert.equal(Object.hasOwn(defaults.presentation.cards[0], 'rgbLedView'), false)
  const invalid = JSON.parse(text)
  invalid.project.modules[0].rgbLed.index = 0
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)))
})

test('rgbLed : liens de dépendance vers un module appelant', () => {
  const layer = buildLinkLayer([
    rgbCard(),
    { id: 'app', type: 'module', x: 600, y: 0, width: 320, height: 220 },
  ], [{ id: 'link', fromId: 'rgb', toId: 'app', exports: [] }])
  assert.equal(layer.edges.length, 1)
})
