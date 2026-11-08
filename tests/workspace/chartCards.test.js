import test from 'node:test'
import assert from 'node:assert/strict'
import { createBarChartModule } from '../../src/utils/barChartNode.js'
import { createHeatmapModule } from '../../src/utils/heatmapNode.js'
import { createXyPlotModule } from '../../src/utils/xyPlotNode.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { initialDocument, reduceDocument, reduceHistory } from '../../src/utils/canvasDocument.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { buildLinkLayer } from '../../src/utils/canvasLinks.js'

for (const [type, factory, actionType] of [['barChart', createBarChartModule, 'createBarChart'], ['heatmap', createHeatmapModule, 'createHeatmap'], ['xyPlot', createXyPlotModule, 'createXyPlot']]) {
  test(`${type} : création, renommage, suppression et undo/redo`, () => {
    const widget = factory('chart', 'Chart', 1)
    const card = { id: 'chart', type, name: 'Chart', x: 0, y: 0, width: moduleTypes[type].width, height: moduleTypes[type].height, expandedNodeIds: [] }
    const action = { type: actionType, card, [type]: widget }
    let history = { past: [], present: initialDocument(), future: [] }
    history = reduceHistory(history, action)
    assert.equal(history.present.project.modules.length, 1)
    history = reduceHistory(history, { type: 'undo' })
    assert.equal(history.present.cards.length, 0)
    history = reduceHistory(history, { type: 'redo' })
    const renamed = reduceDocument(history.present, { type: 'rename', id: 'chart', name: 'Renamed' })
    assert.equal(renamed.project.modules[0].name, 'Renamed')
    assert.equal(reduceDocument(renamed, { type: 'deleteModule', id: 'chart' }).cards.length, 0)
  })

  test(`${type} : vues, nœuds dépliés et source seule conservés`, () => {
    const widget = factory('chart', 'Chart', 1)
    const project = { ...initialDocument().project, modules: [widget.module], nodes: widget.nodes }
    const card = { id: 'chart', type, name: 'Chart', x: 0, y: 0, width: 420, height: 280, expandedNodeIds: [widget.module.rootNodeIds[0]], [`${type}View`]: 'code' }
    const text = serializeWorkspace(project, [card], { x: 0, y: 0, zoomLevel: 0 })
    const workspace = deserializeWorkspace(text)
    assert.deepEqual(workspace.presentation.cards[0], card)
    assert.equal(deserializeWorkspace(JSON.stringify(project)).presentation.cards[0].type, type)
    assert.throws(() => serializeWorkspace(project, [{ ...card, [`${type}View`]: 'invalid' }], workspace.presentation.camera))
    assert.throws(() => serializeWorkspace(project, [{ ...card, id: 'missing' }], workspace.presentation.camera))
    const defaults = JSON.parse(serializeWorkspace(project, [{ ...card, [`${type}View`]: type }], workspace.presentation.camera))
    assert.equal(Object.hasOwn(defaults.presentation.cards[0], `${type}View`), false)
    const invalid = JSON.parse(text)
    invalid.project.modules[0][type].index = 0
    assert.throws(() => deserializeWorkspace(JSON.stringify(invalid)))
    if (type === 'heatmap') {
      for (const width of [0, -1, 1.5, 33]) {
        const invalidDimensions = JSON.parse(text)
        invalidDimensions.project.modules[0].heatmap.width = width
        assert.throws(() => deserializeWorkspace(JSON.stringify(invalidDimensions)))
      }
    }
  })

  test(`${type} : liens de dépendance vers un module appelant`, () => {
    const layer = buildLinkLayer([
      { id: 'chart', type, x: 0, y: 0, width: 420, height: 280 },
      { id: 'app', type: 'module', x: 600, y: 0, width: 320, height: 220 },
    ], [{ id: 'link', fromId: 'chart', toId: 'app', exports: [] }])
    assert.equal(layer.edges.length, 1)
  })
}
