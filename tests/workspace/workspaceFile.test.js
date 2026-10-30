import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { program, root } from '../logic/fixtures.js'

// Prépare un document complet avec annotation, pliage, sélection et vue non initiale.
function fixture() {
  const project = program('m')
  root(project, 'm', 'f', 'FunctionDeclaration', { name: 'start', entryPoint: true, type: { kind: 'primitive', name: 'void' } }, { parameters: [], body: null })
  return { project, cards: [
    { id: 'm', type: 'module', name: 'm', x: -120, y: 80, width: 400, height: 300, expandedNodeIds: ['f'] },
    { id: 'note', type: 'comment', name: 'Note é', text: 'Hello\n世界', x: 500, y: -20, width: 320, height: 220, expandedNodeIds: [] },
  ], camera: { x: 42, y: -17, zoomLevel: -1.25 }, selected: { kind: 'node', id: 'f' } }
}

test('instantané complet : source, annotations, géométrie, pliage et vue conservés', () => {
  const { project, cards, camera, selected } = fixture()
  const before = structuredClone({ project, cards, camera, selected })
  const text = serializeWorkspace(project, cards, camera, selected)
  const restored = deserializeWorkspace(text)
  assert.equal(restored.workspaceVersion, 1)
  assert.deepEqual(restored.project, project)
  assert.deepEqual(restored.presentation, { cards, camera, selected })
  assert.deepEqual({ project, cards, camera, selected }, before)
  assert.deepEqual(deserializeWorkspace(`\uFEFF${text}`), restored)
})

test('source JSON logique seule : cartes déterministes sans toucher aux données', () => {
  const project = program('a', 'b')
  project.application = 'Custom source metadata'
  const restored = deserializeWorkspace(JSON.stringify(project))
  assert.deepEqual(restored.project, project)
  assert.deepEqual(restored.presentation.cards.map((card) => [card.id, card.x, card.y]), [['a', 0, 0], ['b', 380, 0]])
  assert.deepEqual(restored.presentation.camera, { x: 0, y: 0, zoomLevel: 0 })
  assert.equal(restored.presentation.selected, null)
})

test('document vide et programme incomplet restent exportables', () => {
  const empty = program()
  assert.deepEqual(deserializeWorkspace(serializeWorkspace(empty, [], { x: 0, y: 0, zoomLevel: 0 })).project, empty)
  const { project, cards, camera } = fixture()
  assert.equal(deserializeWorkspace(serializeWorkspace(project, cards, camera)).project.nodes[0].children.body, null)
})

test('état de pliage nettoyé après suppression sans modifier les cartes actives', () => {
  const { project, cards, camera } = fixture()
  cards[0].expandedNodeIds.push('deleted')
  const result = deserializeWorkspace(serializeWorkspace(project, cards, camera))
  assert.deepEqual(result.presentation.cards[0].expandedNodeIds, ['f'])
  assert.deepEqual(cards[0].expandedNodeIds, ['f', 'deleted'])
})

test('JSON illisible, versions futures et ancienne catégorie Main refusés sans migration', () => {
  for (const text of ['no json', 'null', '[]', '{"formatVersion":2,"id":"x","modules":[],"nodes":[]}', '{"application":"Sapphire 3","workspaceVersion":99}']) assert.throws(() => deserializeWorkspace(text))
  const project = program('m')
  project.modules[0].kind = 'main'
  assert.throws(() => deserializeWorkspace(JSON.stringify(project)), /Legacy Main/)
  assert.equal(project.modules[0].kind, 'main')
})

test('géométries, références de présentation et identifiants invalides refusés', () => {
  const { project, cards, camera, selected } = fixture()
  const original = JSON.parse(serializeWorkspace(project, cards, camera, selected))
  const changes = [
    (value) => { value.presentation.camera.zoomLevel = 3 },
    (value) => { value.presentation.camera.zoomLevel = -2000 },
    (value) => { value.presentation.cards[0].width = 10 },
    (value) => { value.presentation.cards[0].name = 'wrong' },
    (value) => { value.presentation.cards[0].type = '__proto__' },
    (value) => { value.presentation.cards[0].expandedNodeIds = ['missing'] },
    (value) => { value.presentation.cards.push(value.presentation.cards[0]) },
    (value) => { value.presentation.cards.shift() },
    (value) => { value.presentation.selected.id = 'missing' },
    (value) => { value.project.nodes.push(value.project.nodes[0]) },
    (value) => { value.project.nodes[0].properties.name = {} },
    (value) => { value.project.nodes[0].properties.type.name = {} },
    (value) => { value.project.nodes[0].children.body = { toString: null } },
    (value) => { value.project.modules[0].rootNodeIds = [{}] },
    (value) => { value.project.modules[0].rootNodeIds = null },
  ]
  for (const change of changes) {
    const invalid = structuredClone(original)
    change(invalid)
    assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)))
  }
})

test('valeurs non représentables refusées et champs logiques inconnus préservés', () => {
  const { project, cards, camera } = fixture()
  project.custom = { enabled: true }
  assert.deepEqual(deserializeWorkspace(serializeWorkspace(project, cards, camera)).project.custom, project.custom)
  assert.throws(() => serializeWorkspace(project, cards, { ...camera, x: Infinity }))
  project.custom.value = Infinity
  assert.throws(() => serializeWorkspace(project, cards, camera))
})
