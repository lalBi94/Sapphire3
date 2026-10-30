import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createNodeBundle, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, serializeSource, deserializeSource, diagnosticCodes as codes } from '../../src/utils/logic/index.js'
import { initialNodeForm, nodeConfiguration } from '../../src/components/NodeForm/nodeConfiguration.js'
import { program, root, node } from './fixtures.js'

// Prépare une fonction complète sans imposer de nom ni de signature cible.
function addFunction(source, moduleId, id, name, entryPoint) {
  const declaration = root(source, moduleId, id, 'FunctionDeclaration', { name, type: { kind: 'primitive', name: 'void' }, ...(entryPoint === undefined ? {} : { entryPoint }) }, { parameters: [], body: `${id}-body` })
  node(source, moduleId, `${id}-body`, 'Block', {}, { statements: [] })
  return declaration
}

test('point d’entrée facultatif et explicite, indépendant du nom main', () => {
  const source = program('a', 'b')
  addFunction(source, 'a', 'ordinary', 'main')
  addFunction(source, 'b', 'start', 'start', true)
  const result = analyzeProgram(source)
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.ast.modules[1].body[0].properties.entryPoint, true)
  assert.equal(result.ast.modules[0].body[0].properties.entryPoint, undefined)
  assert.equal(analyzeProgram(program('empty')).canGenerate, true)
})

test('points d’entrée multiples : diagnostics intermodules sans perte de source', () => {
  const source = program('a', 'b')
  addFunction(source, 'a', 'first', 'first', true)
  addFunction(source, 'b', 'second', 'second', true)
  const before = structuredClone(source)
  const result = analyzeProgram(source)
  assert.equal(result.canGenerate, false)
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === codes.duplicateEntryPoint).map((entry) => [entry.location.nodeId, entry.location.field]), [['second', 'properties.entryPoint']])
  assert.deepEqual(source, before)
  const restored = deserializeSource(serializeSource(source).json).source
  assert.deepEqual(restored, source)
  assert.equal(analyzeProgram(restored).canGenerate, false)
})

test('marqueur réservé aux fonctions et booléen strict', () => {
  for (const value of ['true', 1, null]) {
    const source = program('m')
    addFunction(source, 'm', 'f', 'f', value)
    assert.ok(analyzeProgram(source).diagnostics.some((entry) => entry.code === codes.invalidEntryPoint))
  }
  const source = program('m')
  addFunction(source, 'm', 'f', 'f', false)
  assert.deepEqual(analyzeProgram(source).diagnostics, [])
  root(source, 'm', 'block', 'Block', { entryPoint: true }, { statements: [] })
  assert.ok(analyzeProgram(source).diagnostics.some((entry) => entry.code === codes.invalidEntryPoint && entry.location.nodeId === 'block'))
})

test('désignation concurrente refusée, retrait du rôle puis réattribution autorisés', () => {
  const source = program('a', 'b')
  const first = addFunction(source, 'a', 'first', 'first', true)
  const second = addFunction(source, 'b', 'second', 'second')
  const refused = updateSourceNode(source, second.id, { properties: { ...second.properties, entryPoint: true } })
  assert.equal(refused.ok, false)
  assert.equal(refused.code, codes.duplicateEntryPoint)
  assert.equal(refused.project, source)
  const cleared = updateSourceNode(source, first.id, { properties: { ...first.properties, entryPoint: false } })
  assert.equal(cleared.ok, true)
  const assigned = updateSourceNode(cleared.project, second.id, { properties: { ...second.properties, entryPoint: true } })
  assert.equal(assigned.ok, true)
  assert.deepEqual(assigned.analysis.diagnostics, [])
})

test('insertion d’un second point d’entrée rejetée atomiquement', () => {
  const source = program('m')
  addFunction(source, 'm', 'first', 'first', true)
  let id = 0
  const bundle = createNodeBundle('m', { kind: 'FunctionDeclaration', properties: { name: 'second', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, children: { parameters: [], body: { kind: 'Block', children: { statements: [] } } } }, () => `new-${id++}`)
  const result = insertSourceNodes(source, { targetId: { kind: 'module', id: 'm' }, slot: 'rootNodeIds' }, bundle)
  assert.equal(result.ok, false)
  assert.equal(result.project, source)
  assert.ok(result.diagnostics.some((entry) => entry.code === codes.duplicateEntryPoint))
})

test('suppression de la fonction ou de son module libère le rôle', () => {
  const source = program('a', 'b')
  addFunction(source, 'a', 'first', 'first', true)
  const second = addFunction(source, 'b', 'second', 'second')
  for (const result of [deleteSourceNodes(source, { kind: 'node', id: 'first' }), deleteSourceModule(source, 'a')]) {
    assert.equal(result.ok, true)
    const assigned = updateSourceNode(result.project, second.id, { properties: { ...second.properties, entryPoint: true } })
    assert.equal(assigned.ok, true)
    assert.deepEqual(assigned.analysis.diagnostics, [])
  }
})

test('formulaire : marqueur préservé à l’édition et retiré lorsque décoché', () => {
  const source = program('m')
  const declaration = addFunction(source, 'm', 'f', 'start', true)
  const form = initialNodeForm('FunctionDeclaration', declaration, null, [])
  assert.equal(form.entryPoint, true)
  const edited = nodeConfiguration('FunctionDeclaration', { ...form, name: 'renamed' }, [], declaration)
  assert.equal(edited.properties.entryPoint, true)
  assert.equal(edited.properties.name, 'renamed')
  const cleared = nodeConfiguration('FunctionDeclaration', { ...form, entryPoint: false }, [], declaration)
  assert.equal(Object.hasOwn(cleared.properties, 'entryPoint'), false)
})
