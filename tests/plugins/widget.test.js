import test from 'node:test'
import assert from 'node:assert/strict'
import { deserializeWorkspace, emptyWorkspace, serializeWorkspace } from '../../src/utils/workspaceFile.js'
import { createPluginWidgetCard, collectPluginWorkspaceDependencies, resolvePluginWidgetInstance } from '../../src/utils/plugins/pluginWidgets.js'
import { configurePluginRuntime, getActiveWidget, getActiveWidgets } from '../../src/utils/plugins/pluginRuntime.js'
import { readExamplePlugin } from './fixtures.js'

test('widget de plugin : création, état, propriétés et persistance du workspace', () => {
  const plugin = readExamplePlugin('voltmeter')
  configurePluginRuntime([plugin])
  try {
    const entry = getActiveWidget(plugin.id, 'voltmeter')
    assert.ok(entry)
    const card = createPluginWidgetCard(entry, { x: 40, y: 60 })
    assert.equal(card.type, 'pluginWidget')
    assert.equal(card.pluginId, plugin.id)
    assert.equal(card.widgetId, 'voltmeter')
    assert.equal(card.properties.unit, 'V')
    assert.equal(card.state.setpoint, 5)
    assert.deepEqual(card.bindings, { inputs: {}, outputs: {} })
    const instance = resolvePluginWidgetInstance({ ...card, state: { ...card.state, setpoint: 7 } }, entry.widget)
    assert.equal(instance.state.setpoint, 7)

    const workspace = emptyWorkspace()
    const text = serializeWorkspace(workspace.project, [card], workspace.presentation.camera, { kind: 'pluginWidget', id: card.id })
    const loaded = deserializeWorkspace(text)
    assert.equal(loaded.presentation.cards.length, 1)
    const restored = loaded.presentation.cards[0]
    assert.equal(restored.type, 'pluginWidget')
    assert.equal(restored.pluginId, plugin.id)
    assert.equal(restored.widgetId, 'voltmeter')
    assert.equal(restored.pluginVersion, '1.0.0')
    assert.deepEqual(restored.properties, card.properties)
    assert.deepEqual(restored.state, card.state)
    assert.deepEqual(restored.bindings, card.bindings)

    const definitionText = serializeWorkspace(workspace.project, [{ ...card, pluginWidgetView: 'definition' }], workspace.presentation.camera, null)
    assert.equal(deserializeWorkspace(definitionText).presentation.cards[0].pluginWidgetView, 'definition')
    assert.throws(() => serializeWorkspace(workspace.project, [{ ...card, pluginWidgetView: 'code' }], workspace.presentation.camera), (error) => error.code === 'WORKSPACE_INVALID')
  } finally {
    configurePluginRuntime([])
  }
})

test('widget de plugin : données préservées lorsque le plugin est absent', () => {
  configurePluginRuntime([])
  const plugin = readExamplePlugin('voltmeter')
  const entry = { pluginId: plugin.id, pluginVersion: plugin.version, widget: plugin.widgets[0] }
  const card = createPluginWidgetCard(entry, { x: 0, y: 0 })
  card.state = { value: 12.5, setpoint: 8 }
  card.properties = { unit: 'mV', maximum: 20 }
  card.bindings = { inputs: { value: 'voltage' }, outputs: { setpoint: 'callbackNode' } }
  const workspace = emptyWorkspace()
  const text = serializeWorkspace(workspace.project, [card], workspace.presentation.camera, null)
  const loaded = deserializeWorkspace(text)
  const restored = loaded.presentation.cards[0]
  assert.equal(getActiveWidget(plugin.id, 'voltmeter'), null)
  assert.equal(restored.pluginId, plugin.id)
  assert.equal(restored.widgetId, 'voltmeter')
  assert.deepEqual(restored.state, card.state)
  assert.deepEqual(restored.properties, card.properties)
  assert.deepEqual(restored.bindings, card.bindings)

  const dependencies = collectPluginWorkspaceDependencies(loaded.presentation.cards, getActiveWidgets())
  assert.equal(dependencies.length, 1)
  assert.equal(dependencies[0].missing, true)
  assert.equal(dependencies[0].count, 1)
})

test('widget de plugin : forme invalide refusée sans toucher aux cartes intégrées', () => {
  const plugin = readExamplePlugin('voltmeter')
  const entry = { pluginId: plugin.id, pluginVersion: plugin.version, widget: plugin.widgets[0] }
  const card = createPluginWidgetCard(entry, { x: 0, y: 0 })
  const workspace = emptyWorkspace()
  const invalid = { ...card, state: null }
  assert.throws(() => serializeWorkspace(workspace.project, [invalid], workspace.presentation.camera), (error) => error.code === 'WORKSPACE_INVALID')
  const builtIn = { id: 'note', type: 'comment', name: 'Note', x: 0, y: 0, width: 320, height: 220, text: 'hello', expandedNodeIds: [] }
  const text = serializeWorkspace(workspace.project, [builtIn], workspace.presentation.camera)
  assert.equal(JSON.parse(text).presentation.cards[0].type, 'comment')
})
