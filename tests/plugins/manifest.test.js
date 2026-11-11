import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLUGIN_API_VERSION,
  PLUGIN_FORMAT_VERSION,
  PLUGIN_PERMISSIONS,
  PLUGIN_SDK_VERSION,
  createNativeOperationDefinition,
  expandCompositeDraft,
  validatePluginDocument,
} from '../../packages/plugin-sdk/src/index.js'
import { readExamplePlugin } from './fixtures.js'

test('plugin SDK : manifestes d’exemple valides et versionnés', () => {
  assert.equal(PLUGIN_API_VERSION, 1)
  assert.equal(PLUGIN_FORMAT_VERSION, 1)
  assert.equal(PLUGIN_SDK_VERSION, '0.1.0')
  for (const name of ['voltmeter', 'clamp', 'between']) {
    const result = validatePluginDocument(readExamplePlugin(name))
    assert.equal(result.ok, true, `${name}: ${result.diagnostics?.map((entry) => entry.message).join(', ')}`)
    assert.equal(result.plugin.id.startsWith('org.sapphire3.examples.'), true)
    assert.equal(result.plugin.permissions.every((permission) => Object.values(PLUGIN_PERMISSIONS).includes(permission)), true)
  }
})

test('plugin SDK : manifeste invalide, permissions et version refusées', () => {
  const plugin = readExamplePlugin('voltmeter')
  assert.equal(validatePluginDocument(null).ok, false)
  assert.equal(validatePluginDocument({ ...plugin, pluginFormatVersion: 2 }).code, 'PLUGIN_FORMAT_UNSUPPORTED')
  assert.equal(validatePluginDocument({ ...plugin, apiVersion: 2 }).code, 'PLUGIN_API_UNSUPPORTED')
  const unsupported = validatePluginDocument({ ...plugin, permissions: [...plugin.permissions, 'network.access'] })
  assert.equal(unsupported.ok, false)
  assert.ok(unsupported.diagnostics.some((entry) => entry.code === 'PLUGIN_PERMISSION_UNSUPPORTED'))
  const missing = validatePluginDocument({ ...plugin, permissions: ['ui.widgets'] })
  assert.equal(missing.ok, false)
  assert.ok(missing.diagnostics.some((entry) => entry.code === 'PLUGIN_PERMISSION_MISSING'))
})

test('plugin SDK : widget, rendu et état bornés', () => {
  const plugin = readExamplePlugin('voltmeter')
  const badRenderer = structuredClone(plugin)
  badRenderer.widgets[0].renderer.children.push({ kind: 'html', text: '<script>alert(1)</script>' })
  const rendererResult = validatePluginDocument(badRenderer)
  assert.equal(rendererResult.ok, false)
  assert.ok(rendererResult.diagnostics.some((entry) => entry.code === 'PLUGIN_RENDERER_INVALID'))

  const badSource = structuredClone(plugin)
  badSource.widgets[0].renderer.children[1].source = 'input.missing'
  const sourceResult = validatePluginDocument(badSource)
  assert.equal(sourceResult.ok, false)
  assert.ok(sourceResult.diagnostics.some((entry) => entry.code === 'PLUGIN_RENDERER_INVALID'))

  const badSize = structuredClone(plugin)
  badSize.widgets[0].minSize.width = badSize.widgets[0].defaultSize.width + 1
  assert.equal(validatePluginDocument(badSize).ok, false)

  const badState = structuredClone(plugin)
  badState.widgets[0].initialState = { value: { nested: undefined } }
  assert.equal(validatePluginDocument(badState).ok, false)
})

test('plugin SDK : opérations natives typées, validation et émetteurs', () => {
  const plugin = readExamplePlugin('clamp')
  const operation = plugin.nativeOperations[0]
  const definition = createNativeOperationDefinition(plugin, operation)
  assert.equal(definition.id, 'pluginClamp')
  assert.equal(definition.run([12n, 0n, 5n]), 5n)
  assert.equal(definition.run([-2n, 0n, 5n]), 0n)
  assert.equal(definition.run([2n, 0n, 5n]), 2n)
  assert.throws(() => definition.run([2n, 5n, 0n]), (error) => error.code === 'PLUGIN_OPERATION_VALIDATION')
  assert.match(definition.emit('javascript', ['value', 'min', 'max']), /\?/)
  assert.match(definition.emit('python', ['value', 'min', 'max']), / if /)

  const badExpression = structuredClone(plugin)
  badExpression.nativeOperations[0].implementation = { kind: 'call', callee: 'eval', arguments: [] }
  const expressionResult = validatePluginDocument(badExpression)
  assert.equal(expressionResult.ok, false)
  assert.ok(expressionResult.diagnostics.some((entry) => entry.code === 'PLUGIN_EXPRESSION_INVALID'))

  const badTarget = structuredClone(plugin)
  badTarget.nativeOperations[0].transpilers.c = badTarget.nativeOperations[0].transpilers.javascript
  assert.equal(validatePluginDocument(badTarget).ok, false)
})

test('plugin SDK : composite natif et refus des nœuds sémantiques inconnus', () => {
  const plugin = readExamplePlugin('between')
  const composite = plugin.composites[0]
  const draft = expandCompositeDraft(composite)
  assert.equal(draft.kind, 'BinaryExpression')
  assert.equal(draft.properties.operator, 'and')
  assert.equal(draft.children.left.kind, 'BinaryExpression')
  assert.notEqual(draft, composite.expansion)

  const badRoot = structuredClone(plugin)
  badRoot.composites[0].expansion = { kind: 'SemanticMagicNode', properties: {}, children: {} }
  const result = validatePluginDocument(badRoot)
  assert.equal(result.ok, false)
  assert.ok(result.diagnostics.some((entry) => entry.code === 'PLUGIN_COMPOSITE_INVALID'))
})
