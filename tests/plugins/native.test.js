import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createNode, getAvailableActions, getMathNative, mathNatives, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { configurePluginRuntime, applyPluginRuntimePayload, getPluginRuntimePayload } from '../../src/utils/plugins/pluginRuntime.js'
import { buildNativeProject, readExamplePlugin } from './fixtures.js'

// Active un manifeste puis exécute une opération avant de vider le registre.
function withPlugin(document, callback) {
  configurePluginRuntime([document])
  try {
    return callback()
  } finally {
    configurePluginRuntime([])
  }
}

test('opération native : typage, simulation et opération intégrée préservée', () => withPlugin(readExamplePlugin('clamp'), () => {
  const builtInIds = Object.keys(mathNatives)
  const project = buildNativeProject('pluginClamp')
  const analysis = analyzeProgram(project)
  assert.equal(analysis.canGenerate, true, analysis.diagnostics.map((entry) => entry.message).join(', '))
  assert.deepEqual(analysis.diagnostics, [])
  const call = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'call')
  assert.equal(call.type.kind, 'primitive')
  assert.equal(call.type.name, 'int')
  assert.equal(getMathNative('pluginClamp').purity, 'pure')
  assert.equal(getMathNative('clamp').id, 'clamp')
  assert.deepEqual(Object.keys(mathNatives), builtInIds)

  const result = simulateProgram(project)
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['5'])
  assert.equal(result.variables.find((entry) => entry.name === 'value').raw, 5)

  project.nodes.push(createNode('spare', 'app', 'VariableDeclaration', { properties: { name: 'spare', type: { kind: 'primitive', name: 'int' } }, children: { initializer: null }, references: {} }))
  project.modules[0].rootNodeIds.push('spare')
  const actions = getAvailableActions(project, 'spare', 'initializer')
  assert.equal(actions.ok, true)
  assert.ok(actions.actions.some((action) => action.kind === 'MathCall' && action.preset?.name === 'pluginClamp'))
}))

test('opération native : JavaScript, Python et refus C explicite', () => withPlugin(readExamplePlugin('clamp'), () => {
  const project = buildNativeProject('pluginClamp')
  const javascript = transpileProgram(project, { target: 'javascript' })
  assert.equal(javascript.ok, true, javascript.diagnostics?.map((entry) => entry.message).join(', '))
  assert.match(javascript.code, /12n/)
  assert.match(javascript.code, /\?/)

  const python = transpileProgram(project, { target: 'python' })
  assert.equal(python.ok, true, python.diagnostics?.map((entry) => entry.message).join(', '))
  assert.match(python.code, / if /)

  const c = transpileProgram(project, { target: 'c' })
  assert.equal(c.ok, false)
  assert.ok(c.diagnostics.some((entry) => entry.code === 'TRANSPILE_C_UNSUPPORTED'))
}))

test('opération native : payload de worker revalidé et réappliqué', () => withPlugin(readExamplePlugin('clamp'), () => {
  const payload = getPluginRuntimePayload()
  assert.equal(payload.length, 1)
  configurePluginRuntime([])
  assert.equal(getMathNative('pluginClamp'), null)
  applyPluginRuntimePayload(payload)
  assert.equal(getMathNative('pluginClamp').id, 'pluginClamp')
  const project = buildNativeProject('pluginClamp')
  const result = simulateProgram(project)
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, ['5'])
}))

test('opération native : backend absent et opération inconnue', () => {
  const plugin = structuredClone(readExamplePlugin('clamp'))
  plugin.id = 'org.example.no-python'
  plugin.name = 'No Python emitter'
  delete plugin.nativeOperations[0].transpilers.python
  withPlugin(plugin, () => {
    const project = buildNativeProject('pluginClamp')
    const python = transpileProgram(project, { target: 'python' })
    assert.equal(python.ok, false)
    assert.ok(python.diagnostics.some((entry) => entry.code === 'TRANSPILE_EXPRESSION_UNSUPPORTED'))
    assert.ok(python.diagnostics.some((entry) => entry.message.includes('pluginClamp')))
  })
  configurePluginRuntime([])
  const unknown = analyzeProgram(buildNativeProject('pluginClamp'))
  assert.equal(unknown.canGenerate, false)
  assert.ok(unknown.diagnostics.some((entry) => entry.code === 'NODE_INCOMPLETE'))
})
