import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/index.js'
import { serializeWorkspace, deserializeWorkspace, workspaceFileVersion } from '../../src/utils/workspaceFile.js'

const intType = { kind: 'primitive', name: 'int' }

// Prépare un workspace minimal avec une fonction générique historique et une carte portant screenScale.
function legacyWorkspace() {
  const project = createProject('workspace')
  project.modules = [createModule('m', 'Module')]
  project.modules[0].rootNodeIds = ['f']
  project.nodes = [
    createNode('f', 'm', 'FunctionDeclaration', { properties: { name: 'f', type: intType, generic: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'm', 'Block', { properties: {}, children: { statements: [] } }),
  ]
  const cards = [{ id: 'm', type: 'module', name: 'Module', x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }]
  return JSON.parse(serializeWorkspace(project, cards, { x: 0, y: 0, zoomLevel: 0 }))
}

test('migration : un workspace version 1 est normalisé vers la version courante', () => {
  const current = legacyWorkspace()
  const legacy = JSON.parse(JSON.stringify(current))
  legacy.workspaceVersion = 1
  legacy.presentation.cards[0].screenScale = 1.5
  const functionNode = legacy.project.nodes.find((node) => node.kind === 'FunctionDeclaration')
  functionNode.properties.generic = true
  delete functionNode.properties.typeParameters

  const migrated = deserializeWorkspace(JSON.stringify(legacy))
  assert.equal(migrated.workspaceVersion, workspaceFileVersion)
  assert.equal(migrated.workspaceVersion, 2)
  const migratedFunction = migrated.project.nodes.find((node) => node.kind === 'FunctionDeclaration')
  assert.deepEqual(migratedFunction.properties.typeParameters, [{ name: 'T' }])
  assert.equal(Object.hasOwn(migratedFunction.properties, 'generic'), false)
  assert.equal(Object.hasOwn(migrated.presentation.cards[0], 'screenScale'), false)
  assert.deepEqual(deserializeWorkspace(JSON.stringify(migrated)), migrated, 'la migration est stable')
})

test('migration : la version courante est relue sans transformation', () => {
  const current = legacyWorkspace()
  current.project.nodes.find((node) => node.kind === 'FunctionDeclaration').properties.typeParameters = [{ name: 'T' }]
  delete current.project.nodes.find((node) => node.kind === 'FunctionDeclaration').properties.generic
  assert.deepEqual(deserializeWorkspace(JSON.stringify(current)), current)
})

test('migration : une version future ou malformée est refusée sans perte silencieuse', () => {
  const future = legacyWorkspace()
  future.workspaceVersion = workspaceFileVersion + 1
  assert.throws(() => deserializeWorkspace(JSON.stringify(future)), (error) => error.code === 'WORKSPACE_VERSION_UNSUPPORTED')
  for (const workspaceVersion of [0, -1, 1.5, '1', null]) {
    const malformed = { ...legacyWorkspace(), workspaceVersion }
    assert.throws(() => deserializeWorkspace(JSON.stringify(malformed)), (error) => error.code === 'WORKSPACE_VERSION_UNSUPPORTED')
  }
})
