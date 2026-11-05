import test from 'node:test'
import assert from 'node:assert/strict'
import { createHeatmapModule } from '../../src/utils/heatmapNode.js'
import { heatmapGlobalName, readHeatmapStates } from '../../src/utils/logic/heatmapState.js'
import { createProject, createModule, createNode, analyzeProgram, simulateProgram, createDebugSession } from '../../src/utils/logic/index.js'
import { transpileProgram, transpileSelection } from '../../src/utils/transpilation/index.js'

// Pilote la grille depuis un module consommateur avec des coordonnées explicites.
function fixture(x = 2, y = 1, clear = false) {
  const heatmap = createHeatmapModule('heat', 'Heat', 1, { width: 3, height: 2 })
  const project = createProject('p')
  const app = createModule('app', 'App')
  project.modules.push(heatmap.module, app)
  project.nodes.push(...heatmap.nodes)
  const add = (id, kind, properties = {}, children = {}, references = {}) => project.nodes.push(createNode(id, app.id, kind, { properties, children, references }))
  const intType = { kind: 'primitive', name: 'int' }
  app.rootNodeIds.push('main')
  add('main', 'FunctionDeclaration', { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, { parameters: [], body: 'body' })
  add('body', 'Block', {}, { statements: clear ? ['set', 'clear'] : ['set'] })
  for (const [id, value] of [['x', x], ['y', y], ['value', -7]]) add(id, 'Literal', { type: intType, value: String(value) })
  for (const [prefix, name, args] of [['set', 'SET_CELL', ['x', 'y', 'value']], ...(clear ? [['clear', 'CLEAR', []]] : [])]) {
    const exported = heatmap.module.exports.find((entry) => entry.name === `HEATMAP_SP3_${name}_1`)
    app.imports.push({ id: prefix, moduleId: 'heat', nodeId: exported.nodeId, localName: prefix })
    add(prefix, 'ExpressionStatement', {}, { expression: `${prefix}Call` })
    add(`${prefix}Call`, 'CallExpression', {}, { callee: `${prefix}Ref`, arguments: args })
    add(`${prefix}Ref`, 'Reference', {}, {}, { target: { kind: 'import', importId: prefix } })
  }
  return project
}

test('heatmap : module ordinaire, int[] et API exacte sans nouvelle construction', () => {
  const project = fixture()
  assert.deepEqual(analyzeProgram(project).diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(project.modules[0].heatmap, { index: 1, width: 3, height: 2 })
  assert.deepEqual(project.modules[0].exports.map((entry) => entry.name), ['HEATMAP_SP3_SET_CELL_1', 'HEATMAP_SP3_CLEAR_1'])
})

test('heatmap : SET_CELL écrit une cellule signée, instantanés indépendants, sans images à 24 fps', () => {
  const result = simulateProgram(fixture())
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.heatmaps.heat, { width: 3, height: 2, values: [0, 0, 0, 0, 0, -7] })
  assert.equal(result.heatmapFrames.length, result.trace.length)
  assert.ok(result.heatmapFrames.some((frame) => frame.heat?.values.every((value) => value === 0)))
  assert.equal(result.screenFrames, undefined)
  assert.equal(result.screenFrameHeatmaps, undefined)
})

test('heatmap : CLEAR conserve les dimensions et remet la grille à zéro', () => {
  const result = simulateProgram(fixture(2, 1, true))
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.heatmaps.heat.values, [0, 0, 0, 0, 0, 0])
  assert.ok(result.heatmapFrames.some((frame) => frame.heat?.values[5] === -7))
})

test('heatmap : chaque axe est borné sans repli silencieux vers une autre ligne', () => {
  for (const [x, y] of [[-1, 1], [3, 0], [0, -1], [0, 2]]) {
    const result = simulateProgram(fixture(x, y))
    assert.equal(result.errorCode, 'SIMULATION_ARRAY_BOUNDS')
    assert.deepEqual(result.heatmaps.heat.values, [0, 0, 0, 0, 0, 0])
    assert.ok(result.heatmapFrames.length > 0)
  }
})

test('heatmap : le débogage retrouve les cellules et la remise à zéro', () => {
  const session = createDebugSession(fixture(2, 1, true))
  assert.equal(session.errorCode, null)
  assert.ok(session.frames.some((frame) => frame.heatmaps.heat?.values[5] === -7))
  assert.deepEqual(session.frames.at(-1).heatmaps.heat.values, [0, 0, 0, 0, 0, 0])
})

test('heatmap : lecteur sans données, valeurs non initialisées et copie du tableau', () => {
  const project = fixture()
  const dataId = project.nodes.find((node) => node.properties?.name === heatmapGlobalName(1)).id
  assert.deepEqual(readHeatmapStates(project, new Map()), {})
  assert.deepEqual(readHeatmapStates(project, new Map([[dataId, Array(6).fill(Symbol())]])), {})
  const data = [0n, 1n, 2n, 3n, 4n, 5n]
  const state = readHeatmapStates(project, new Map([[dataId, data]]))
  data[0] = 99n
  assert.equal(state.heat.values[0], 0)
})

test('heatmap : refus explicite des deux cibles et des extraits', () => {
  for (const target of ['javascript', 'python']) {
    assert.equal(transpileProgram(fixture(), { target }).code, 'TRANSPILE_HEATMAP_UNSUPPORTED')
    assert.equal(transpileSelection(fixture(), { kind: 'module', id: 'heat' }, { target }).code, 'TRANSPILE_HEATMAP_UNSUPPORTED')
  }
})
