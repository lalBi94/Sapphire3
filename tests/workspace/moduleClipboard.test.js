import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { captureSourceModule, pasteSourceModule } from '../../src/utils/logic/index.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'

// Produit des identifiants uniques pour une copie de test.
function idFactory() {
  let value = 0
  return () => `clipboard-module-${++value}`
}

test('module copié : la carte et le module sont ajoutés, puis annulés ensemble', () => {
  const workspace = workspaceTemplates.find((entry) => entry.id === 'classInstance').build()
  const state = reduceDocument(initialDocument(), { type: 'replaceWorkspace', workspace })
  const card = state.cards.find((entry) => entry.id === 'templateCounterClass')
  const captured = captureSourceModule(state.project, 'templateCounterClass', { card })
  assert.equal(captured.ok, true, captured.code)
  const prepared = pasteSourceModule(state.project, captured.clipboard, { idFactory: idFactory(), index: state.index })
  assert.equal(prepared.ok, true, prepared.code)
  const action = { type: 'pasteModule', previousProject: state.project, prepared, clipboard: captured.clipboard, position: { x: 0, y: 0 }, idFactory: idFactory() }
  const next = reduceDocument(state, action)
  assert.equal(next.project.modules.length, state.project.modules.length + 1)
  assert.equal(next.cards.length, state.cards.length + 1)
  const pastedCard = next.cards.find((entry) => entry.id === prepared.module.id)
  assert.ok(pastedCard)
  assert.equal(pastedCard.type, 'class')
  assert.equal(pastedCard.name, 'Counter 2')
  assert.equal(pastedCard.emoji, card.emoji)

  const history = reduceHistory({ past: [], present: state, future: [] }, action)
  assert.equal(history.past.length, 1)
  const undone = reduceHistory(history, { type: 'undo' })
  assert.equal(undone.present.project.modules.length, state.project.modules.length)
  assert.equal(undone.present.cards.length, state.cards.length)
})
