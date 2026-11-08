import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram } from '../../src/utils/logic/index.js'
import { runLiveProgram } from '../../src/utils/logic/liveSimulation.js'
import { createInputButtonModule } from '../../src/utils/inputButtonNode.js'
import { createLedModule, ledDefaults } from '../../src/utils/ledNode.js'
import { examples } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'

// Construit une boucle infinie : LED = isPress() à chaque itération.
function liveLoopProject() {
  const project = createProject('liveLoop')
  const toggle = createInputButtonModule('liveToggle', 'Toggle', 1, { mode: 'toggle' })
  project.modules.push(toggle.module)
  project.nodes.push(...toggle.nodes)
  const led = createLedModule('liveLed', 'LED', 1, ledDefaults)
  project.modules.push(led.module)
  project.nodes.push(...led.nodes)
  const app = createModule('liveApp', 'Live app')
  project.modules.push(app)
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `live:${++sequence}`
    project.nodes.push(createNode(id, app.id, kind, { properties, children, references }))
    return id
  }
  const importId = (name) => `live:import:${name}`
  const getter = toggle.module.exports.find((entry) => entry.name === 'isPress')
  app.imports.push({ id: importId('isPress'), moduleId: toggle.module.id, nodeId: getter.nodeId, localName: 'isPress' })
  const setter = led.module.exports.find((entry) => entry.name === led.functions.setValue)
  app.imports.push({ id: importId('setLed'), moduleId: led.module.id, nodeId: setter.nodeId, localName: 'setLed' })
  const callee = (name) => node('Reference', {}, {}, { target: { kind: 'import', importId: importId(name) } })
  const read = node('CallExpression', {}, { callee: callee('isPress'), arguments: [] })
  const write = node('CallExpression', {}, { callee: callee('setLed'), arguments: [read] })
  const statement = node('ExpressionStatement', {}, { expression: write })
  const body = node('Block', {}, { statements: [statement] })
  const test = node('Literal', { type: { kind: 'primitive', name: 'boolean' }, value: true })
  const loop = node('WhileStatement', {}, { test, body })
  const mainBody = node('Block', {}, { statements: [loop] })
  const main = node('FunctionDeclaration', { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, { parameters: [], body: mainBody })
  app.rootNodeIds.push(main)
  const globalNodeId = toggle.nodes.find((entry) => entry.properties?.name?.includes('ISPRESS')).id
  return { project, globalNodeId }
}

test('run live : boucle infinie, entrée appliquée entre deux frames et arrêt demandé', async () => {
  const { project, globalNodeId } = liveLoopProject()
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const frames = []
  const result = await runLiveProgram(project, {
    inputs: { [globalNodeId]: false },
    sliceSteps: 10,
    onFrame: async (state) => {
      frames.push(state)
      if (frames.length === 1) return { inputs: { [globalNodeId]: true } }
      if (frames.length === 4) return { stop: true }
      return {}
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.stopped, true)
  assert.ok(result.steps > 20)
  assert.equal(frames[0].leds.liveLed.value, false)
  assert.equal(frames.at(-1).leds.liveLed.value, true)
  assert.equal(frames.length, 4)
})

test('run live : classes et widgets exécutés par tranches', async () => {
  const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === 'reactorControl').build()))
  const frames = []
  const result = await runLiveProgram(workspace.project, {
    sliceSteps: 20,
    onFrame: async (state) => {
      frames.push(state)
      return frames.length >= 5 ? { stop: true } : {}
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.stopped, true)
  assert.ok(frames.length >= 5)
  assert.ok(frames.some((frame) => frame.leds.reactorLed))
})

test('run live : les animations et simulations continues bouclent, sans casser le borné', async () => {
  for (const id of ['rotatingTriangle', 'pendulumWave', 'thermostat']) {
    const workspace = deserializeWorkspace(JSON.stringify(examples.find((entry) => entry.id === id).build()))
    const flag = workspace.project.nodes.find((node) => node.kind === 'VariableDeclaration' && node.properties?.name === 'SP3_LIVE')
    assert.ok(flag, `${id}: drapeau SP3_LIVE déclaré`)
    const frames = []
    const result = await runLiveProgram(workspace.project, {
      sliceSteps: 50,
      onFrame: () => {
        frames.push(1)
        return frames.length >= 3 ? { stop: true } : {}
      },
    })
    assert.equal(result.ok, true, `${id}: ${result.errorCode ?? ''}`)
    assert.equal(result.stopped, true, `${id}: la boucle ne se termine pas`)
  }
})
