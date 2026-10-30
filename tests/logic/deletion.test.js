import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, deleteSourceNodes, deleteSourceModule, deserializeSource, serializeSource, diagnosticCodes as codes } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

// Supprime aussi les fragments propriétaires sans toucher aux autres modules ni à la source initiale.
test('suppression de module : contenu retiré, références externes conservées', () => {
  const source = program('m', 'other')
  root(source, 'm', 'target', 'VariableDeclaration', { name: 'target', type: intType })
  node(source, 'm', 'detached', 'Literal', { type: intType, value: 1 })
  root(source, 'other', 'consumer', 'VariableDeclaration', { name: 'consumer', type: intType }, { initializer: 'reference' })
  node(source, 'other', 'reference', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'target' } })
  const before = structuredClone(source)
  const result = deleteSourceModule(source, 'm')
  assert.equal(result.ok, true)
  assert.deepEqual(source, before)
  assert.deepEqual(result.project.modules.map((entry) => entry.id), ['other'])
  assert.deepEqual(result.project.nodes.map((entry) => entry.id), ['consumer', 'reference'])
  assert.deepEqual(result.project.nodes[1].references.target, { kind: 'node', nodeId: 'target' })
  assert.equal(result.analysis.diagnostics.some((entry) => entry.code === codes.unresolved), true)
  assert.equal(result.selection, null)
})

// Autorise le retrait du Main et refuse une cible absente ou ambiguë sans perte de données.
test('suppression de module : Main, cibles invalides et doublons', () => {
  const source = program('m')
  source.modules[0].kind = 'main'
  assert.equal(deleteSourceModule(source, 'm').project.modules.length, 0)
  for (const id of ['absent', null, '']) {
    const result = deleteSourceModule(source, id)
    assert.equal(result.ok, false)
    assert.equal(result.project, source)
  }
  const duplicate = { ...source, modules: [...source.modules, source.modules[0]] }
  assert.equal(deleteSourceModule(duplicate, 'm').ok, false)
  assert.equal(deleteSourceModule({}, 'm').ok, false)
})

// Supprime un nœud sans toucher au parent ni aux autres enfants.
test('suppression d’un enfant unique : lien remis à null et identifiants conservés', () => {
  const source = program('m')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: intType }, { initializer: 'literal' })
  node(source, 'm', 'literal', 'Literal', { type: intType, value: 1 })
  const result = deleteSourceNodes(source, { kind: 'node', id: 'literal' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.removedNodeIds, ['literal'])
  assert.deepEqual(result.selection, { kind: 'node', id: 'v' })
  assert.equal(result.project.nodes.length, 1)
  assert.equal(result.project.nodes[0].children.initializer, null)
  assert.equal(result.project.nodes[0].id, 'v')
  assert.equal(result.analysis.canGenerate, true)
  const restored = deserializeSource(serializeSource(result.project).json).source
  assert.deepEqual(restored, result.project)
})

// Conserve l'ordre syntaxique des entrées restantes d'un slot multiple.
test('suppression dans une liste : ordre des autres instructions préservé', () => {
  const source = program('m')
  root(source, 'm', 'block', 'Block', {}, { statements: ['first', 'second', 'third'] })
  node(source, 'm', 'first', 'VariableDeclaration', { name: 'first', type: intType })
  node(source, 'm', 'second', 'VariableDeclaration', { name: 'second', type: intType })
  node(source, 'm', 'third', 'VariableDeclaration', { name: 'third', type: intType })
  const result = deleteSourceNodes(source, { kind: 'node', id: 'second' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.project.nodes.find((entry) => entry.id === 'block').children.statements, ['first', 'third'])
  assert.equal(result.analysis.canGenerate, true)
})

// Retire toute l'arborescence syntaxique et sélectionne le conteneur parent.
test('suppression d’une fonction : paramètres et corps retirés, racine déliée', () => {
  const source = program('m')
  root(source, 'm', 'function', 'FunctionDeclaration', { name: 'f', type: { kind: 'primitive', name: 'void' } }, { parameters: ['parameter'], body: 'body' })
  node(source, 'm', 'parameter', 'Parameter', { name: 'p', type: intType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['return'] })
  node(source, 'm', 'return', 'ReturnStatement')
  const result = deleteSourceNodes(source, { kind: 'node', id: 'function' })
  assert.equal(result.ok, true)
  assert.deepEqual([...result.removedNodeIds].sort(), ['body', 'function', 'parameter', 'return'])
  assert.deepEqual(result.selection, { kind: 'module', id: 'm' })
  assert.deepEqual(result.project.modules[0].rootNodeIds, [])
  assert.deepEqual(result.project.nodes, [])
  assert.equal(result.analysis.canGenerate, true)
})

// Une référence existante reste dans la source et devient un diagnostic visible.
test('suppression d’une cible référencée : référence conservée et signalée', () => {
  const source = program('m')
  root(source, 'm', 'target', 'VariableDeclaration', { name: 'target', type: intType })
  root(source, 'm', 'consumer', 'VariableDeclaration', { name: 'consumer', type: intType }, { initializer: 'reference' })
  node(source, 'm', 'reference', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'target' } })
  const result = deleteSourceNodes(source, { kind: 'node', id: 'target' })
  assert.equal(result.ok, true)
  const reference = result.project.nodes.find((entry) => entry.id === 'reference')
  assert.deepEqual(reference.references.target, { kind: 'node', nodeId: 'target' })
  assert.equal(result.analysis.diagnostics.some((diagnostic) => diagnostic.code === codes.unresolved), true)
  assert.equal(result.analysis.canGenerate, false)
})

// Refuse les cibles qui ne sont pas un nœud relié une seule fois, sans modifier la source.
test('cibles invalides : module, identifiant absent ou ambigu, nœud détaché', () => {
  const source = program('m')
  root(source, 'm', 'v', 'VariableDeclaration', { name: 'v', type: intType })
  node(source, 'm', 'detached', 'Block', {}, { statements: [] })
  for (const target of ['m', 'absent', { kind: 'node', id: 'detached' }]) {
    const result = deleteSourceNodes(source, target)
    assert.equal(result.ok, false)
    assert.equal(result.project, source)
  }
  const ambiguous = program('m')
  node(ambiguous, 'm', 'm', 'Block', {}, { statements: [] })
  assert.equal(deleteSourceNodes(ambiguous, 'm').ok, false)
  assert.equal(deleteSourceNodes({}, { kind: 'node', id: 'x' }).ok, false)
})
