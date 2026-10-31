import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { createModule, captureSourceNode, pasteSourceNode, duplicateSourceNode, moveSourceNode, deleteSourceNodes, insertSourceNodes, createNode } from '../../src/utils/logic/index.js'
import { debugFixture, node, intType } from '../logic/fixtures.js'

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

// Installe un document de transfert sans API native ni historique préalable.
function transferDocument() {
  const project = debugFixture()
  project.modules.push(createModule('other', 'Other'))
  const cards = project.modules.map((module) => ({ ...card(module.id), name: module.name }))
  return reduceHistory({ past: [], present: initialDocument(), future: [] }, { type: 'replaceWorkspace', workspace: { project, presentation: { cards } } })
}

test('transferts : chaque collage, duplication ou déplacement est une seule étape undo/redo', () => {
  for (const type of ['pasteNode', 'duplicateNode', 'moveNode']) {
    let history = transferDocument()
    const before = history.present.project
    const clipboard = captureSourceNode(before, 'deadPrint').clipboard
    const ids = clipboard.nodes.map((_, index) => `new-${index}`)
    const receiver = { kind: 'module', id: 'other' }
    const prepared = type === 'pasteNode' ? pasteSourceNode(before, clipboard, receiver, { ids }) : type === 'duplicateNode' ? duplicateSourceNode(before, 'deadPrint', { ids }) : moveSourceNode(before, 'deadPrint', receiver)
    assert.equal(prepared.ok, true)
    history = reduceHistory(history, { type, previousProject: before, prepared, clipboard, ids, receiver, id: 'deadPrint' })
    assert.equal(history.past.length, 1)
    assert.equal(history.present.project, prepared.project)
    history = reduceHistory(history, { type: 'undo' })
    assert.equal(history.present.project, before)
    history = reduceHistory(history, { type: 'redo' })
    assert.equal(history.present.project, prepared.project)
    const serialized = serializeWorkspace(history.present.project, history.present.cards, { x: 0, y: 0, zoomLevel: 0 })
    assert.deepEqual(deserializeWorkspace(serialized).project, prepared.project)
  }
})

test('transfert préparé : rejeu sur une source concurrente, mêmes ids et modifications conservées', () => {
  let history = transferDocument()
  const original = history.present.project
  const clipboard = captureSourceNode(original, 'deadPrint').clipboard
  const ids = clipboard.nodes.map((_, index) => `new-${index}`)
  const receiver = { kind: 'module', id: 'other' }
  const prepared = pasteSourceNode(original, clipboard, receiver, { ids })
  history = reduceHistory(history, { type: 'rename', id: 'other', name: 'Renamed' })
  history = reduceHistory(history, { type: 'pasteNode', previousProject: original, prepared, clipboard, receiver, ids })
  assert.equal(history.present.project.modules[1].name, 'Renamed')
  assert.equal(history.present.index.nodes.has(ids[0]), true)
  assert.equal(history.present.project.nodes.filter(({ id }) => id === ids[0]).length, 1)
})

test('rejeu refusé : destinataire occupé ou source supprimée, sans perte ni étape d’historique', () => {
  let history = transferDocument()
  const initial = history.present.project
  node(initial, 'm', 'emptyPrint', 'PrintStatement', {}, { value: null })
  initial.nodes.find(({ id }) => id === 'mainBody').children.statements.push('emptyPrint')
  history = reduceHistory(history, { type: 'replaceWorkspace', workspace: { project: initial, presentation: { cards: history.present.cards } } })
  const clipboard = captureSourceNode(initial, 'deadValue').clipboard
  const ids = ['new-literal']
  const receiver = { kind: 'node', id: 'emptyPrint' }
  const prepared = pasteSourceNode(initial, clipboard, receiver, { ids })
  assert.equal(prepared.ok, true)
  const fill = insertSourceNodes(initial, { targetId: receiver, slot: 'value' }, { ok: true, rootId: 'occupied', nodes: [createNode('occupied', 'm', 'Literal', { properties: { type: intType, value: '3' } })] })
  history = reduceHistory(history, { type: 'replaceWorkspace', workspace: { project: fill.project, presentation: { cards: history.present.cards } } })
  const current = history.present.project
  const rejected = reduceHistory(history, { type: 'pasteNode', previousProject: initial, prepared, clipboard, receiver, ids })
  assert.equal(rejected.present.project, current)
  assert.equal(rejected.past.length, history.past.length)
  assert.equal(rejected.present.index.nodes.has('new-literal'), false)
  const moved = moveSourceNode(current, 'deadPrint', { kind: 'module', id: 'other' })
  const deleted = deleteSourceNodes(current, { kind: 'node', id: 'deadPrint' })
  history = reduceHistory(history, { type: 'replaceWorkspace', workspace: { project: deleted.project, presentation: { cards: history.present.cards } } })
  const result = reduceHistory(history, { type: 'moveNode', previousProject: current, prepared: moved, id: 'deadPrint', receiver: { kind: 'module', id: 'other' } })
  assert.equal(result.present.project, deleted.project)
  assert.equal(result.past.length, 0)
})
