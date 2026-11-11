import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject } from '../../src/utils/logic/model.js'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'

// Prépare un document avec une annotation et un historique vide.
function historyDocument() {
  const project = createProject('historyTest')
  const card = { id: 'note', type: 'comment', name: 'Note', x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [], text: 'Hello' }
  const present = reduceDocument(initialDocument(), {
    type: 'replaceWorkspace',
    workspace: { project, presentation: { cards: [card], camera: { x: 0, y: 0, zoomLevel: 0 } } },
  })
  return { past: [], present, future: [], checkpoint: null }
}

test('historique : un geste de déplacement groupé crée une seule étape', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'historyStart' })
  history = reduceHistory(history, { type: 'geometry', id: 'note', patch: { x: 40 } })
  history = reduceHistory(history, { type: 'geometry', id: 'note', patch: { x: 80 } })
  history = reduceHistory(history, { type: 'historyEnd' })
  assert.equal(history.past.length, 1)
  assert.equal(history.present.cards[0].x, 80)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].x, 0)
  history = reduceHistory(history, { type: 'redo' })
  assert.equal(history.present.cards[0].x, 80)
})

test('historique : un geste sans changement ne crée aucune étape', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'historyStart' })
  history = reduceHistory(history, { type: 'historyEnd' })
  assert.equal(history.past.length, 0)
  assert.equal(history.checkpoint, null)
})

test('historique : les saisies d’annotation sont groupées jusqu’à la sortie du champ', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'historyStart' })
  history = reduceHistory(history, { type: 'text', id: 'note', patch: { text: 'Hello w' } })
  history = reduceHistory(history, { type: 'text', id: 'note', patch: { text: 'Hello world' } })
  history = reduceHistory(history, { type: 'historyEnd' })
  assert.equal(history.past.length, 1)
  assert.equal(history.present.cards[0].text, 'Hello world')
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].text, 'Hello')
})

test('historique : les actions de présentation explicites sont annulables, les valeurs runtime non', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'presentation', id: 'note', patch: { hidden: true }, history: true })
  assert.equal(history.past.length, 1)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].hidden, undefined)
  history = reduceHistory(history, { type: 'presentation', id: 'note', patch: { value: 3 } })
  assert.equal(history.past.length, 0)
  assert.equal(history.present.cards[0].value, 3)
})

test('historique : une vue de carte et un redimensionnement automatique restent hors historique', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'geometry', id: 'note', patch: { screenView: 'code' }, history: false })
  history = reduceHistory(history, { type: 'geometry', id: 'note', patch: { width: 400 }, history: false })
  assert.equal(history.past.length, 0)
  assert.equal(history.present.cards[0].screenView, 'code')
  assert.equal(history.present.cards[0].width, 400)
})

test('historique : une disposition groupée et une suppression d’annotation sont annulables', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'layout', positions: { note: { x: 120, y: 80 } } })
  assert.equal(history.past.length, 1)
  history = reduceHistory(history, { type: 'deleteComment', id: 'note' })
  assert.equal(history.present.cards.length, 0)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards.length, 1)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].x, 0)
  assert.equal(history.present.cards[0].y, 0)
})

test('historique : undo termine d’abord un geste en cours', () => {
  let history = historyDocument()
  history = reduceHistory(history, { type: 'historyStart' })
  history = reduceHistory(history, { type: 'geometry', id: 'note', patch: { x: 50 } })
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].x, 0)
  assert.equal(history.past.length, 0)
  assert.equal(history.checkpoint, null)
})
