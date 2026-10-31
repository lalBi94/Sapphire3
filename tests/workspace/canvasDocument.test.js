import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'

// Fournit une carte valide sans dépendre des identifiants aléatoires du hook React.
function card(id, type = 'module') {
  return { id, type, name: id, x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [], ...(type === 'image' ? { image: '', caption: '' } : type === 'comment' ? { text: '' } : {}) }
}

test('suppression des images et commentaires : présentation seule, module protégé', () => {
  let document = initialDocument()
  for (const type of ['module', 'comment', 'image']) document = reduceDocument(document, { type: 'createCard', card: card(type, type) })
  const project = document.project
  for (const id of ['comment', 'image', 'module']) document = reduceDocument(document, { type: 'deleteComment', id })
  assert.deepEqual(document.cards.map((entry) => entry.id), ['module'])
  assert.equal(document.project, project)
})

test('undo/redo : révisions monotones pour réinitialiser les interactions restaurées', () => {
  let history = { past: [], present: initialDocument(), future: [] }
  history = reduceHistory(history, { type: 'createCard', card: card('m') })
  history = reduceHistory(history, { type: 'rename', id: 'm', name: 'Renamed' })
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.cards[0].name, 'm')
  assert.equal(history.present.revision, 1)
  history = reduceHistory(history, { type: 'redo' })
  assert.equal(history.present.cards[0].name, 'Renamed')
  assert.equal(history.present.revision, 2)
  assert.equal(history.present.project.modules[0].name, 'Renamed')
})

test('une édition de présentation après undo invalide redo sans multiplier les étapes de glisser', () => {
  for (const type of ['geometry', 'text', 'presentation']) {
    let history = { past: [], present: initialDocument(), future: [] }
    history = reduceHistory(history, { type: 'createCard', card: card('m') })
    history = reduceHistory(history, { type: 'rename', id: 'm', name: 'Renamed' })
    history = reduceHistory(history, { type: 'undo' })
    history = reduceHistory(history, { type, id: 'm', patch: { x: 12 } })
    assert.equal(history.future.length, 0)
    assert.equal(history.past.length, 1)
    assert.equal(history.present.cards[0].x, 12)
  }
})

test('import : historique isolé du précédent fichier et instantané réexportable', () => {
  let history = { past: [], present: initialDocument(), future: [] }
  history = reduceHistory(history, { type: 'createCard', card: card('old') })
  history = reduceHistory(history, { type: 'undo' })
  const target = reduceDocument(initialDocument(), { type: 'createCard', card: card('new') })
  const workspace = deserializeWorkspace(serializeWorkspace(target.project, target.cards, { x: 0, y: 0, zoomLevel: 0 }))
  history = reduceHistory(history, { type: 'replaceWorkspace', workspace })
  assert.equal(history.past.length, 0)
  assert.equal(history.future.length, 0)
  assert.equal(reduceHistory(history, { type: 'undo' }), history)
  assert.equal(history.present.cards[0].id, 'new')
  assert.doesNotThrow(() => serializeWorkspace(history.present.project, history.present.cards, workspace.presentation.camera))
})
