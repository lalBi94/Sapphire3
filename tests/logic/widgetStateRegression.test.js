import test from 'node:test'
import assert from 'node:assert/strict'
import { createGaugeModule } from '../../src/utils/gaugeNode.js'
import { createProgressModule } from '../../src/utils/progressNode.js'
import { createBarChartModule } from '../../src/utils/barChartNode.js'
import { createLedModule } from '../../src/utils/ledNode.js'
import { createRgbLedModule } from '../../src/utils/rgbLedNode.js'
import { readGaugeStates } from '../../src/utils/logic/gaugeState.js'
import { readProgressStates } from '../../src/utils/logic/progressState.js'
import { createProject, createNode, simulateProgram, createDebugSession } from '../../src/utils/logic/index.js'

for (const [name, factory, reader] of [['Gauge', createGaugeModule, readGaugeStates], ['ProgressBar', createProgressModule, readProgressStates]]) {
  test(`${name} : une globale absente ou non initialisée ne fait pas échouer le lecteur`, () => {
    const widget = factory('w', name, 1)
    const project = { modules: [widget.module], nodes: widget.nodes }
    const ids = widget.nodes.filter((node) => node.kind === 'VariableDeclaration').map((node) => node.id)
    const values = new Map(ids.map((id) => [id, 10]))
    for (const id of ids) {
      for (const invalid of [undefined, null, Symbol('uninitialized'), '10', true]) {
        assert.deepEqual(reader(project, new Map([...values, [id, invalid]])), {})
      }
    }
    assert.deepEqual(reader(project, new Map(ids.map((id) => [id, 10n]))).w, { value: 10, min: 10, max: 10 })
  })

  test(`${name} : modifier le code pour laisser une globale non initialisée reste simulable`, () => {
    const widget = factory('w', name, 1)
    const project = createProject('p')
    project.modules.push(widget.module)
    project.nodes.push(...widget.nodes)
    const global = project.nodes.find((node) => node.kind === 'VariableDeclaration')
    const initializerId = global.children.initializer
    global.children.initializer = null
    project.nodes = project.nodes.filter((node) => node.id !== initializerId)
    widget.module.rootNodeIds.push('main')
    project.nodes.push(
      createNode('main', 'w', 'FunctionDeclaration', { properties: { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, children: { parameters: [], body: 'body' } }),
      createNode('body', 'w', 'Block', { children: { statements: [] } }),
    )
    assert.equal(simulateProgram(project).ok, true)
    assert.equal(createDebugSession(project).errorCode, null)
  })
}

for (const [name, factory, field, suffix] of [
  ['Gauge', createGaugeModule, 'gauges', 'GET_VALUE_1'],
  ['ProgressBar', createProgressModule, 'progresses', 'GET_VALUE_1'],
  ['BarChart', createBarChartModule, 'barCharts', 'CLEAR_1'],
  ['LED', createLedModule, 'leds', 'GET_VALUE_1'],
  ['RGB LED', createRgbLedModule, 'rgbLeds', 'GET_RED_1'],
]) {
  test(`${name} : tous les arrêts identiques partagent le même état de debug`, () => {
    const widget = factory('w', name, 1)
    const project = createProject('p')
    project.modules.push(widget.module)
    project.nodes.push(...widget.nodes)
    const functionId = widget.module.exports.find((entry) => entry.name.endsWith(suffix)).nodeId
    const session = createDebugSession(project, { functionId, args: [] })
    assert.equal(session.errorCode, null)
    let shared = 0
    for (let index = 1; index < session.frames.length; index += 1) {
      const previous = session.frames[index - 1][field]
      const current = session.frames[index][field]
      if (JSON.stringify(previous) === JSON.stringify(current)) {
        assert.equal(current, previous)
        shared += 1
      }
    }
    assert.ok(shared >= 2)
  })
}
