import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, simulateProgram } from '../../src/utils/logic/index.js'
import { examples } from '../../src/utils/examples.js'

// Produit une boucle infinie avec Print pour comparer les deux modes sur la même source.
function infinitePrint() {
  const project = createProject('continuous')
  project.modules = [createModule('m', 'Continuous')]
  project.modules[0].rootNodeIds = ['main']
  project.nodes = [
    createNode('main', 'm', 'FunctionDeclaration', { properties: { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'm', 'Block', { children: { statements: ['loop'] } }),
    createNode('loop', 'm', 'WhileStatement', { children: { test: 'true', body: 'loopBody' } }),
    createNode('true', 'm', 'Literal', { properties: { type: { kind: 'primitive', name: 'boolean' }, value: true } }),
    createNode('loopBody', 'm', 'Block', { children: { statements: ['print'] } }),
    createNode('print', 'm', 'PrintStatement', { children: { value: 'value' } }),
    createNode('value', 'm', 'Literal', { properties: { type: { kind: 'primitive', name: 'int' }, value: '42' } }),
  ]
  return project
}

test('continu : dépasse le budget sans historique, sortie bornée, Run ordinaire inchangé', () => {
  const project = infinitePrint()
  assert.equal(simulateProgram(project, { maxSteps: 100 }).errorCode, 'SIMULATION_STEP_LIMIT')
  let latest
  const result = simulateProgram(project, {
    maxSteps: 100, continuous: true,
    onContinuous(snapshot) {
      latest = snapshot()
      if (latest.steps >= 25000) throw Object.assign(new Error('Test interrupted'), { code: 'TEST_STOP' })
    },
  })
  assert.equal(result.errorCode, 'TEST_STOP')
  assert.equal(latest.steps, 25000)
  assert.equal(latest.trace.length, 1)
  assert.equal(latest.output.length, 200)
  assert.equal(result.outputSteps.length, 0)
  assert.equal(result.output.length, 200)
  assert.equal(result.trace.length, 1)
})

test('continu : même résultat fini et états widgets, sans captures historiques', () => {
  const project = examples.find((entry) => entry.id === 'rgbMixer').build().project
  const regular = simulateProgram(project)
  const continuous = simulateProgram(project, { continuous: true, onContinuous() {} })
  assert.equal(continuous.ok, true, continuous.errorCode)
  assert.deepEqual(continuous.output, regular.output)
  for (const field of ['screens', 'gauges', 'leds', 'rgbLeds', 'progresses', 'barCharts', 'heatmaps']) {
    assert.deepEqual(continuous[field], regular[field], field)
  }
  assert.equal(continuous.screenFrames.length, 0)
  assert.equal(continuous.gaugeFrames.length, 0)
  assert.equal(continuous.progressFrames.length, 0)
  assert.equal(continuous.trace.length, 1)
})

test('continu : refuse le debug et un consommateur absent ; validations conservées', () => {
  assert.equal(simulateProgram(infinitePrint(), { continuous: true }).errorCode, 'SIMULATION_BUDGET_INVALID')
  assert.equal(simulateProgram(infinitePrint(), { continuous: true, captureDebug: true, onContinuous() {} }).errorCode, 'SIMULATION_BUDGET_INVALID')
  const project = infinitePrint()
  project.nodes.find((node) => node.id === 'value').properties.type.name = 'void'
  assert.equal(simulateProgram(project, { continuous: true, onContinuous() {} }).errorCode, 'SIMULATION_DIAGNOSTICS')
})
