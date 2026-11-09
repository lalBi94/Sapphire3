import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardModuleMap, dashboardModuleMapFromCards } from '../../src/utils/dashboardModuleMap.js'

test('mini-carte : modules et classes placés en colonnes selon leurs dépendances', () => {
  const map = buildDashboardModuleMap(
    [
      { id: 'app', name: 'App', kind: 'module' },
      { id: 'math', name: 'Math', kind: 'module' },
      { id: 'rotor', name: 'Rotor', kind: 'class' },
    ],
    [
      { fromId: 'math', toId: 'app' },
      { fromId: 'rotor', toId: 'app' },
    ],
  )
  assert.equal(map.boxes.length, 3)
  assert.equal(map.edges.length, 2)
  assert.ok(map.width > 0 && map.height > 0)
  const app = map.boxes.find((box) => box.id === 'app')
  const math = map.boxes.find((box) => box.id === 'math')
  assert.ok(math.x < app.x, 'un exportateur précède son utilisateur')
  assert.equal(map.boxes.find((box) => box.id === 'rotor').kind, 'class')
  assert.match(map.edges[0].path, /^M[\d.]+ [\d.]+ C/)
})

test('mini-carte : les liens invalides, les doublons et les cycles restent bornés', () => {
  const map = buildDashboardModuleMap(
    [
      { id: 'a', name: 'A', kind: 'module' },
      { id: 'b', name: 'B', kind: 'module' },
    ],
    [
      { fromId: 'a', toId: 'a' },
      { fromId: 'a', toId: 'missing' },
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'a' },
    ],
  )
  assert.equal(map.boxes.length, 2)
  assert.equal(map.edges.length, 2)
  assert.ok(map.edges.every((edge) => edge.path.length > 0))
})

test('mini-carte : seules les cartes Module/Class visibles et liées sont retenues', () => {
  const modules = new Map([
    ['app', { id: 'app', name: 'App', kind: 'module' }],
    ['math', { id: 'math', name: 'Math', kind: 'module' }],
    ['hidden', { id: 'hidden', name: 'Hidden', kind: 'module' }],
  ])
  const index = {
    modules,
    nodes: new Map(),
    analysis: {
      semantic: {
        symbols: [
          { id: 'symbol', importedFrom: 'math', moduleId: 'app', nodeId: 'node', name: 'sum' },
          { id: 'hiddenSymbol', importedFrom: 'hidden', moduleId: 'app', nodeId: 'hiddenNode', name: 'draw' },
        ],
        references: [{ symbolId: 'symbol' }, { symbolId: 'hiddenSymbol' }],
      },
    },
  }
  const map = dashboardModuleMapFromCards([
    { id: 'app', type: 'module', name: 'App' },
    { id: 'math', type: 'module', name: 'Math' },
    { id: 'hidden', type: 'module', name: 'Hidden', hidden: true },
    { id: 'comment', type: 'comment', name: 'Note' },
  ], index)
  assert.deepEqual(map.boxes.map((box) => box.id), ['math', 'app'])
  assert.equal(map.edges.length, 1)
  assert.equal(map.edges[0].fromId, 'math')
  assert.equal(map.edges[0].toId, 'app')
  assert.equal(map.owners.hidden, 'app')
})
