import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardContractPanels } from '../../src/utils/dashboardContracts.js'
import { examples } from '../../src/utils/examples.js'

test('contrats du dashboard : groupés par module avec nœud et règle', () => {
  const project = {
    modules: [
      { id: 'app', name: 'App', kind: 'module' },
      { id: 'math', name: 'Math', kind: 'module' },
      { id: 'empty', name: 'Empty', kind: 'module' },
    ],
    nodes: [
      { id: 'a', moduleId: 'app', kind: 'VariableDeclaration', properties: { name: 'quality' }, contracts: [{ kind: 'between', arguments: [0, 100] }] },
      { id: 'b', moduleId: 'app', kind: 'VariableDeclaration', properties: { name: 'samples' }, contracts: [{ kind: 'nonEmpty' }] },
      { id: 'c', moduleId: 'math', kind: 'Parameter', properties: { name: 'x' }, contracts: [{ kind: 'positive' }] },
      { id: 'd', moduleId: 'app', kind: 'VariableDeclaration', properties: { name: 'plain' } },
      { id: 'e', moduleId: 'empty', kind: 'VariableDeclaration', properties: { name: 'none' } },
    ],
  }
  const panels = dashboardContractPanels(project)
  assert.equal(panels.length, 2)
  assert.deepEqual(panels.map((panel) => panel.id), ['contracts:app', 'contracts:math'])
  assert.equal(panels[0].name, 'App')
  assert.equal(panels[0].type, 'contracts')
  assert.deepEqual(panels[0].contracts.map((contract) => [contract.nodeName, contract.kind, contract.arguments]), [
    ['quality', 'between', [0, 100]],
    ['samples', 'nonEmpty', []],
  ])
  assert.equal(panels[1].contracts[0].nodeKind, 'Parameter')
})

test('contrats du dashboard : l’exemple Orbital trails expose un panneau explicite', () => {
  const example = examples.find((entry) => entry.id === 'orbitalTrails')
  assert.ok(example)
  const panels = dashboardContractPanels(example.build().project)
  assert.equal(panels.length, 1)
  assert.equal(panels[0].contracts[0].nodeName, 'angle')
  assert.equal(panels[0].contracts[0].kind, 'nonNegative')
})
