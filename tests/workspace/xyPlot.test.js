import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, analyzeProgram, simulateProgram, getModuleLinks, createContextIndex } from '../../src/utils/logic/index.js'
import { transpileProgram, transpileSelection } from '../../src/utils/transpilation/index.js'
import { createXyPlotModule, xyPlotDefaultSamples } from '../../src/utils/xyPlotNode.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'

const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }

// Construit un traceur et un module appelant qui lui passe wave(x) = sin(x).
function functionPlotProject() {
  const project = createProject('xyPlot')
  const plot = createXyPlotModule('plot', 'Function plot', 1)
  const app = createModule('app', 'App')
  const exported = plot.module.exports.find((entry) => entry.name === plot.functions.setFunction)
  app.imports.push({ id: 'setFunctionImport', moduleId: plot.module.id, nodeId: exported.nodeId, localName: 'setFunction' })
  project.modules = [plot.module, app]
  project.nodes = [
    ...plot.nodes,
    createNode('main', 'app', 'FunctionDeclaration', { properties: { name: 'main', type: voidType, entryPoint: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'app', 'Block', { children: { statements: ['setStatement', 'print'] } }),
    createNode('setStatement', 'app', 'ExpressionStatement', { children: { expression: 'setCall' } }),
    createNode('setCall', 'app', 'CallExpression', { children: { callee: 'setCallee', arguments: ['waveRef'] } }),
    createNode('setCallee', 'app', 'Reference', { references: { target: { kind: 'import', importId: 'setFunctionImport' } } }),
    createNode('waveRef', 'app', 'Reference', { references: { target: { kind: 'name', name: 'wave' } } }),
    createNode('wave', 'app', 'FunctionDeclaration', { properties: { name: 'wave', type: doubleType }, children: { parameters: ['waveX'], body: 'waveBody' } }),
    createNode('waveX', 'app', 'Parameter', { properties: { name: 'x', type: doubleType } }),
    createNode('waveBody', 'app', 'Block', { children: { statements: ['waveReturn'] } }),
    createNode('waveReturn', 'app', 'ReturnStatement', { children: { argument: 'sinCall' } }),
    createNode('sinCall', 'app', 'MathCall', { properties: { name: 'sin' }, children: { arguments: ['xRef'] } }),
    createNode('xRef', 'app', 'Reference', { references: { target: { kind: 'name', name: 'x' } } }),
    createNode('message', 'app', 'Literal', { properties: { type: { kind: 'primitive', name: 'string' }, value: 'Function plotted' } }),
    createNode('print', 'app', 'PrintStatement', { children: { value: 'message' } }),
  ]
  app.rootNodeIds = ['wave', 'main']
  return { project, plot }
}

test('XY plot : module caché, SET_FUNCTION et échantillonnage réel', () => {
  const { project, plot } = functionPlotProject()
  assert.equal(plot.module.xyPlot.samples, xyPlotDefaultSamples)
  assert.deepEqual(plot.module.exports.map((entry) => entry.name), [
    'XYPLOT_SP3_SET_FUNCTION_1',
    'XYPLOT_SP3_SET_RANGE_1',
    'XYPLOT_SP3_CLEAR_1',
  ])
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.deepEqual(result.output, ['Function plotted'])
  const state = result.xyPlots.plot
  assert.equal(state.points.length, xyPlotDefaultSamples)
  assert.ok(Math.abs(state.points[0][0] + 10) < 1e-9)
  assert.ok(Math.abs(state.points[0][1] - Math.sin(-10)) < 1e-9)
  assert.ok(Math.abs(state.points.at(-1)[0] - 10) < 1e-9)
  assert.ok(state.yMin < -1 && state.yMax > 1)
  assert.ok(result.xyPlotFrames.length > 0)
})

test('XY plot : refus explicite de la transpilation', () => {
  const { project } = functionPlotProject()
  for (const target of ['javascript', 'python']) {
    assert.equal(transpileProgram(project, { target }).code, 'TRANSPILE_XY_PLOT_UNSUPPORTED')
    assert.equal(transpileSelection(project, { kind: 'module', id: 'plot' }, { target }).code, 'TRANSPILE_XY_PLOT_UNSUPPORTED')
  }
})

test('XY plot : carte, vues et lien de dépendance depuis le module caché', () => {
  assert.equal(moduleTypes.xyPlot.hasXyPlot, true)
  assert.equal(moduleTypes.xyPlot.renamable, true)
  const { project } = functionPlotProject()
  const analysis = analyzeProgram(project)
  const links = getModuleLinks(createContextIndex(project, analysis))
  assert.ok(links.some((link) => link.fromId === 'plot' && link.toId === 'app'))
})
