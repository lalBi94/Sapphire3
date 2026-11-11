import test from 'node:test'
import assert from 'node:assert/strict'
import { createModule, createNode, createProject, createNodeBundle, getAvailableActions, insertSourceNodes } from '../../src/utils/logic/index.js'
import { configurePluginRuntime } from '../../src/utils/plugins/pluginRuntime.js'
import { readExamplePlugin, intType } from './fixtures.js'

// Construit un module minimal avec une variable dont l'initialiseur est libre.
function projectWithInitializerSlot() {
  const project = createProject('composite')
  const module = createModule('app', 'App')
  module.rootNodeIds.push('value')
  project.modules.push(module)
  project.nodes.push(createNode('value', 'app', 'VariableDeclaration', { properties: { name: 'value', type: { kind: 'primitive', name: 'boolean' } }, children: { initializer: null }, references: {} }))
  return project
}

test('composite : action de menu, expansion native et insertion atomique', () => {
  const plugin = readExamplePlugin('between')
  configurePluginRuntime([plugin])
  try {
    const project = projectWithInitializerSlot()
    const available = getAvailableActions(project, 'value', 'initializer')
    assert.equal(available.ok, true)
    const action = available.actions.find((entry) => entry.composite?.compositeId === 'between')
    assert.ok(action)
    assert.equal(action.kind, 'BinaryExpression')
    assert.equal(action.group, 'plugin.composites')
    assert.equal(action.label, 'Value between bounds')
    assert.equal(action.composite.draft.kind, 'BinaryExpression')

    let sequence = 0
    const bundle = createNodeBundle('app', action.composite.draft, () => `composite-${++sequence}`)
    assert.equal(bundle.ok, true, bundle.code)
    const inserted = insertSourceNodes(project, { targetId: 'value', slot: 'initializer' }, bundle)
    assert.equal(inserted.ok, true, inserted.code)
    const root = inserted.project.nodes.find((node) => node.id === inserted.nodeId)
    assert.equal(root.kind, 'BinaryExpression')
    assert.equal(root.properties.operator, 'and')
    assert.equal(inserted.project.nodes.filter((node) => node.kind === 'Hole').length, 4)
    assert.equal(inserted.analysis.diagnostics.some((entry) => entry.code === 'NODE_DETACHED'), false)
  } finally {
    configurePluginRuntime([])
  }
})

test('composite : désactivé, le registre ne propose plus l’action', () => {
  configurePluginRuntime([])
  const project = projectWithInitializerSlot()
  const available = getAvailableActions(project, 'value', 'initializer')
  assert.equal(available.ok, true)
  assert.equal(available.actions.some((entry) => entry.composite), false)
})

test('composite : racine incompatible refusée par le moteur', () => {
  const plugin = readExamplePlugin('between')
  configurePluginRuntime([plugin])
  try {
    const project = projectWithInitializerSlot()
    const available = getAvailableActions(project, 'value', 'initializer')
    const action = available.actions.find((entry) => entry.composite?.compositeId === 'between')
    let sequence = 0
    const bundle = createNodeBundle('app', action.composite.draft, () => `composite-${++sequence}`)
    const inserted = insertSourceNodes(project, { targetId: 'value', slot: 'initializer' }, bundle)
    assert.equal(inserted.ok, true)
    const second = insertSourceNodes(inserted.project, { targetId: 'value', slot: 'initializer' }, bundle)
    assert.equal(second.ok, false)
    assert.equal(second.code, 'SLOT_OCCUPIED')
  } finally {
    configurePluginRuntime([])
  }
})
