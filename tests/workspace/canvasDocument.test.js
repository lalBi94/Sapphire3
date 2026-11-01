import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { serializeWorkspace, deserializeWorkspace, emptyWorkspace } from '../../src/utils/workspaceFile.js'
import { createModule, captureSourceNode, pasteSourceNode, duplicateSourceNode, moveSourceNode, deleteSourceNodes, insertSourceNodes, createNode, captureBookmark, insertBookmark } from '../../src/utils/logic/index.js'
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

test('masquer une carte : présentation seule, drapeau conservé et écrit seulement quand il est vrai', () => {
  let history = { past: [], present: initialDocument(), future: [] }
  for (const type of ['module', 'comment', 'image']) history = reduceHistory(history, { type: 'createCard', card: card(type, type) })
  history = reduceHistory(history, { type: 'rename', id: 'module', name: 'Renamed' })
  history = reduceHistory(history, { type: 'undo' })
  const before = history
  history = reduceHistory(history, { type: 'presentation', id: 'module', patch: { hidden: true } })
  assert.equal(history.past.length, before.past.length, 'masquer ne crée pas une étape annulable')
  assert.equal(history.future.length, 0, 'masquer invalide le redo comme toute édition de présentation')
  assert.equal(history.present.project, before.present.project, 'la source logique reste la même carte mémoire')
  assert.equal(history.present.project.modules.length, 1)
  assert.deepEqual(history.present.cards.map((entry) => entry.hidden), [true, undefined, undefined])
  const hidden = deserializeWorkspace(serializeWorkspace(history.present.project, history.present.cards, { x: 0, y: 0, zoomLevel: 0 }))
  assert.deepEqual(hidden.presentation.cards.map((entry) => entry.id), ['module', 'comment', 'image'])
  assert.equal(hidden.presentation.cards[0].hidden, true)
  assert.equal(Object.hasOwn(hidden.presentation.cards[1], 'hidden'), false)
  history = reduceHistory(history, { type: 'presentation', id: 'module', patch: { hidden: false } })
  const shown = deserializeWorkspace(serializeWorkspace(history.present.project, history.present.cards, { x: 0, y: 0, zoomLevel: 0 }))
  assert.equal(Object.hasOwn(shown.presentation.cards[0], 'hidden'), false, 'un drapeau faux n’est pas écrit dans le fichier')
})

test('visibilité de carte : import refusé pour un non-booléen, drapeau faux jamais écrit', () => {
  const document = reduceDocument(initialDocument(), { type: 'createCard', card: card('module') })
  const camera = { x: 0, y: 0, zoomLevel: 0 }
  const written = (hidden) => JSON.parse(serializeWorkspace(document.project, hidden === undefined ? [card('module')] : [{ ...card('module'), hidden }], camera))
  assert.equal(written(true).presentation.cards[0].hidden, true)
  assert.equal(Object.hasOwn(written(false).presentation.cards[0], 'hidden'), false)
  assert.doesNotThrow(() => deserializeWorkspace(JSON.stringify(written(true))))
  const invalid = written(true)
  invalid.presentation.cards[0].hidden = 'yes'
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)), { message: 'Invalid card visibility.' })
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

test('nouveau document : un workspace vierge remplace le document par un état vide, sans historique', () => {
  const workspace = emptyWorkspace()
  const text = serializeWorkspace(workspace.project, workspace.presentation.cards, workspace.presentation.camera, workspace.presentation.selected)
  const roundTrip = deserializeWorkspace(text)
  assert.deepEqual(roundTrip.presentation.cards, [])
  assert.deepEqual(roundTrip.project.modules, [])
  assert.deepEqual(roundTrip.project.nodes, [])
  const filled = reduceHistory({ past: [], present: reduceDocument(initialDocument(), { type: 'createCard', card: card('m') }), future: [] }, { type: 'replaceWorkspace', workspace })
  assert.deepEqual(filled.present.cards, [])
  assert.equal(filled.present.project.modules.length, 0)
  assert.equal(filled.past.length, 0, 'le nouveau document repart sans historique')
})

test('verrouillage de carte : drapeau de présentation, sans étape d’historique et écrit seulement quand il est vrai', () => {
  const camera = { x: 0, y: 0, zoomLevel: 0 }
  const document = reduceDocument(initialDocument(), { type: 'createCard', card: card('module') })
  const written = (value) => JSON.parse(serializeWorkspace(document.project, value === undefined ? [card('module')] : [{ ...card('module'), locked: value }], camera))
  assert.doesNotThrow(() => deserializeWorkspace(JSON.stringify(written(true))))
  assert.equal(written(false).presentation.cards[0].locked, undefined, 'un verrou faux n’est jamais écrit')
  assert.equal(written(undefined).presentation.cards[0].locked, undefined)
  assert.equal(written(true).presentation.cards[0].locked, true)
  const invalid = written(true)
  invalid.presentation.cards[0].locked = 'yes'
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)), { message: 'Invalid card lock.' })
  const history = reduceHistory({ past: [], present: document, future: [] }, { type: 'presentation', id: 'module', patch: { locked: true } })
  assert.equal(history.present.cards[0].locked, true)
  assert.equal(history.past.length, 0, 'le verrou est une présentation, pas une étape d’historique')
})

test('favori inséré : nouveau module, une seule étape undo/redo, source rejouable', () => {
  let history = transferDocument()
  const before = history.present.project
  const captured = captureBookmark(before, { kind: 'node', id: 'unused' })
  assert.equal(captured.ok, true)
  const bookmark = { id: 'b1', savedAt: 0, ...captured.bookmark }
  const ids = bookmark.nodes.map((_, index) => `fav-${index}`)
  const prepared = insertBookmark(before, bookmark, { moduleId: 'fav', moduleName: 'Favourite', ids })
  assert.equal(prepared.ok, true)
  history = reduceHistory(history, { type: 'insertBookmark', previousProject: before, prepared, bookmark, moduleId: 'fav', moduleName: 'Favourite', ids, position: { x: 10, y: 20 } })
  assert.equal(history.past.length, 1)
  assert.equal(history.present.project, prepared.project)
  const cardEntry = history.present.cards.find((entry) => entry.id === 'fav')
  assert.equal(cardEntry.name, 'Favourite')
  assert.equal(cardEntry.x, 10)
  assert.equal(cardEntry.y, 20)
  history = reduceHistory(history, { type: 'undo' })
  assert.equal(history.present.project, before)
  assert.equal(history.present.cards.some((entry) => entry.id === 'fav'), false)
})

test('emoji de carte : conservé à l’aller-retour et refusé s’il est mal formé', () => {
  const camera = { x: 0, y: 0, zoomLevel: 0 }
  const document = reduceDocument(initialDocument(), { type: 'createCard', card: card('module') })
  const withEmoji = reduceDocument(document, { type: 'presentation', id: 'module', patch: { emoji: '🚀' } })
  assert.equal(withEmoji.cards[0].emoji, '🚀')
  const text = serializeWorkspace(withEmoji.project, withEmoji.cards, camera)
  assert.equal(JSON.parse(text).presentation.cards[0].emoji, '🚀')
  assert.equal(deserializeWorkspace(text).presentation.cards[0].emoji, '🚀')
  const empty = reduceDocument(document, { type: 'presentation', id: 'module', patch: { emoji: '' } })
  assert.equal(Object.hasOwn(JSON.parse(serializeWorkspace(empty.project, empty.cards, camera)).presentation.cards[0], 'emoji'), false, 'un emoji vide n’est pas écrit')
  const invalid = JSON.parse(text)
  invalid.presentation.cards[0].emoji = 5
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)), { message: 'Invalid card emoji.' })
})

test('contrats : conservés à l’aller-retour et refusés s’ils sont mal formés', () => {
  const camera = { x: 0, y: 0, zoomLevel: 0 }
  const document = reduceDocument(initialDocument(), { type: 'createCard', card: card('module') })
  document.project.nodes.push({ id: 'x', moduleId: 'module', kind: 'VariableDeclaration', properties: { name: 'x', type: { kind: 'primitive', name: 'int' } }, children: { initializer: null }, references: {}, contracts: [{ kind: 'positive' }] })
  document.project.modules[0].rootNodeIds.push('x')
  const text = serializeWorkspace(document.project, document.cards, camera)
  const roundTrip = deserializeWorkspace(text)
  assert.deepEqual(roundTrip.project.nodes.find((node) => node.id === 'x').contracts, [{ kind: 'positive' }])
  const invalid = JSON.parse(text)
  invalid.project.nodes.find((node) => node.id === 'x').contracts = [{ kind: 'bogus' }]
  assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)), { message: 'Invalid node contracts.' })
})
