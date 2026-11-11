import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, createModule, createNode, createProject } from '../../src/utils/logic/index.js'
import { buildLinkLayer } from '../../src/utils/canvasLinks.js'
import { getPluginWidgetLinks } from '../../src/utils/pluginWidgetLinks.js'

// Construit un module avec une variable et une fonction utilisées par un widget de plugin.
function linkedProject() {
  const project = createProject('plugin-links')
  const module = createModule('app', 'App')
  module.rootNodeIds.push('temperature', 'onThreshold')
  project.modules.push(module)
  const intType = { kind: 'primitive', name: 'int' }
  const voidType = { kind: 'primitive', name: 'void' }
  project.nodes.push(
    createNode('temperature', 'app', 'VariableDeclaration', { properties: { name: 'temperature', type: intType }, children: { initializer: 'one' }, references: {} }),
    createNode('one', 'app', 'Literal', { properties: { type: intType, value: 1 }, children: {}, references: {} }),
    createNode('onThreshold', 'app', 'FunctionDeclaration', { properties: { name: 'onThreshold', type: voidType }, children: { parameters: [], body: 'body' }, references: {} }),
    createNode('body', 'app', 'Block', { properties: {}, children: { statements: [] }, references: {} }),
  )
  const card = {
    id: 'plugin-card',
    type: 'pluginWidget',
    name: 'Digital voltmeter',
    pluginId: 'org.example.voltmeter',
    widgetId: 'voltmeter',
    x: 400,
    y: 0,
    width: 360,
    height: 250,
    bindings: { inputs: { value: 'temperature' }, outputs: { threshold: 'onThreshold' } },
  }
  return { project, card }
}

test('liens de plugin : dépendances vers les variables et fonctions liées', () => {
  const { project, card } = linkedProject()
  const analysis = analyzeProgram(project)
  const index = createContextIndex(project, analysis)
  const links = getPluginWidgetLinks(project, index, [card])
  assert.equal(links.length, 1)
  assert.equal(links[0].fromId, 'app')
  assert.equal(links[0].toId, card.id)
  assert.equal(links[0].fromName, 'App')
  assert.equal(links[0].toName, 'Digital voltmeter')
  assert.deepEqual(links[0].exports.map((entry) => entry.name).sort(), ['onThreshold', 'temperature'])
  const layer = buildLinkLayer([
    { id: 'app', type: 'module', x: 0, y: 0, width: 320, height: 220 },
    card,
  ], links)
  assert.ok(layer)
  assert.equal(layer.edges.length, 1)
  assert.match(layer.edges[0].d, /^M/)
})

test('liens de plugin : aucune dépendance pour un widget masqué ou sans liaison', () => {
  const { project, card } = linkedProject()
  const analysis = analyzeProgram(project)
  const index = createContextIndex(project, analysis)
  assert.deepEqual(getPluginWidgetLinks(project, index, [{ ...card, hidden: true }]), [])
  assert.deepEqual(getPluginWidgetLinks(project, index, [{ ...card, bindings: { inputs: {}, outputs: {} } }]), [])
})
