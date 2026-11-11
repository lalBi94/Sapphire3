import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode } from '../../src/utils/logic/model.js'
import { analyzeProgram, captureSourceModule, createContextIndex, decodeClipboardPayload, encodeClipboardPayload, pasteSourceModule } from '../../src/utils/logic/index.js'
import { createScreenModule } from '../../src/utils/screenNode.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Compteur d'identifiants déterministe pour les tests de copie.
function idFactory() {
  let value = 0
  return () => `copy-id-${++value}`
}

// Construit une bibliothèque `helper` et une application qui l'importe.
function importProject() {
  const project = createProject('moduleTransferTest')
  const library = createModule('lib', 'Library')
  const app = createModule('app', 'App')
  project.modules.push(library, app)
  const nodes = []
  const node = (id, moduleId, kind, properties = {}, children = {}, references = {}) => {
    const value = createNode(id, moduleId, kind, { properties, children, references })
    nodes.push(value)
    return id
  }

  const helperValue = node('lib:value', 'lib', 'Literal', { type: intType, value: '1' })
  const helperReturn = node('lib:return', 'lib', 'ReturnStatement', {}, { argument: helperValue })
  const helperBody = node('lib:body', 'lib', 'Block', {}, { statements: [helperReturn] })
  const helper = node('lib:helper', 'lib', 'FunctionDeclaration', { name: 'helper', type: intType }, { parameters: [], body: helperBody })
  library.rootNodeIds.push(helper)
  library.exports.push({ nodeId: helper, name: 'helper' })

  const call = node('app:call', 'app', 'CallExpression', {}, { callee: 'app:callee', arguments: [] })
  node('app:callee', 'app', 'Reference', {}, {}, { target: { kind: 'import', importId: 'app:import' } })
  const print = node('app:print', 'app', 'PrintStatement', {}, { value: call })
  const mainBody = node('app:body', 'app', 'Block', {}, { statements: [print] })
  const main = node('app:main', 'app', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: mainBody })
  app.rootNodeIds.push(main)
  app.imports.push({ id: 'app:import', moduleId: 'lib', nodeId: 'lib:helper', localName: 'helper' })
  project.nodes.push(...nodes)
  return project
}

test('presse-papiers : encodage et décodage d’une capture Sapphire', () => {
  const encoded = encodeClipboardPayload('module', { version: 1, module: { id: 'm' } })
  assert.deepEqual(decodeClipboardPayload(encoded), { kind: 'module', payload: { version: 1, module: { id: 'm' } } })
  assert.equal(decodeClipboardPayload('plain text'), null)
  assert.equal(decodeClipboardPayload('{"marker":"other"}'), null)
  assert.equal(encodeClipboardPayload('other', {}), null)
})

test('module : copie entière avec de nouveaux identifiants et imports conservés', () => {
  const project = importProject()
  const captured = captureSourceModule(project, 'app')
  assert.equal(captured.ok, true, captured.code)
  const pasted = pasteSourceModule(project, captured.clipboard, { idFactory: idFactory(), index: createContextIndex(project, analyzeProgram(project)) })
  assert.equal(pasted.ok, true, pasted.code)
  assert.notEqual(pasted.module.id, 'app')
  assert.equal(pasted.module.name, 'App 2')
  assert.equal(pasted.module.imports[0].moduleId, 'lib')
  assert.equal(pasted.module.imports[0].nodeId, 'lib:helper')
  assert.ok(pasted.nodes.every((node) => node.moduleId === pasted.module.id))
  assert.deepEqual(analyzeProgram(pasted.project).diagnostics, [])
})

test('module : une classe se copie avec son identifiant de classe remappé', () => {
  const workspace = workspaceTemplates.find((entry) => entry.id === 'classInstance').build()
  const captured = captureSourceModule(workspace.project, 'templateCounterClass')
  assert.equal(captured.ok, true, captured.code)
  const pasted = pasteSourceModule(workspace.project, captured.clipboard, { idFactory: idFactory(), index: createContextIndex(workspace.project, analyzeProgram(workspace.project)) })
  assert.equal(pasted.ok, true, pasted.code)
  assert.equal(pasted.module.kind, 'class')
  assert.equal(pasted.module.name, 'Counter 2')
  assert.deepEqual(analyzeProgram(pasted.project).diagnostics, [])
})

test('module : un widget et un import manquant sont refusés', () => {
  const project = importProject()
  const screen = createScreenModule('screen', 'Screen', 1, { width: 4, height: 4 })
  project.modules.push(screen.module)
  project.nodes.push(...screen.nodes)
  assert.equal(captureSourceModule(project, 'screen').code, 'TRANSFER_MODULE_UNSUPPORTED')

  const captured = captureSourceModule(project, 'app')
  const onlyApp = {
    ...project,
    modules: project.modules.filter((module) => module.id === 'app'),
    nodes: project.nodes.filter((node) => node.moduleId === 'app'),
  }
  const pasted = pasteSourceModule(onlyApp, captured.clipboard, { idFactory: idFactory(), index: createContextIndex(onlyApp, analyzeProgram(onlyApp)) })
  assert.equal(pasted.ok, false)
  assert.equal(pasted.code, 'TRANSFER_IMPORT_MISSING')
})
