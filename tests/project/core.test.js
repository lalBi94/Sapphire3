import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROJECT_API_VERSION,
  PROJECT_ERROR_CODES,
  PROJECT_FORMAT_VERSION,
  PROJECT_VERSION,
  ProjectError,
  WORKSPACE_VERSION,
  assertWorkspaceResult,
  buildWorkspaceArchive,
  createEmptyWorkspace,
  createMemoryStorage,
  createWorkspace,
  createWorkspaceBuilder,
  drafts,
  exportWorkspaceArchiveToStorage,
  isProjectError,
  loadProject,
  loadWorkspace,
  loadWorkspaceArchiveFromStorage,
  loadWorkspaceBundle,
  loadWorkspaceFromStorage,
  moduleKinds,
  readWorkspaceArchive,
  saveWorkspaceBundle,
  saveWorkspaceToStorage,
  serializeProject,
  serializeWorkspace,
  types,
  validateProject,
  validateWorkspace,
} from '../../packages/project/src/index.js'
import { deserializeWorkspace, serializeWorkspace as serializeAppWorkspace } from '../../src/utils/workspaceFile.js'
import { buildWorkspaceZip, readWorkspaceZip } from '../../src/utils/workspaceArchive.js'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { initialDocument, reduceDocument } from '../../src/utils/canvasDocument.js'

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nK0AAAAASUVORK5CYII='

// Construit un workspace valide avec deux modules, une classe et un import.
function buildExampleWorkspace() {
  const builder = createWorkspaceBuilder({ id: 'agent-demo' })
  builder.addModule('math', { name: 'Math', x: 0, y: 0 })
  builder.addFunction('math', {
    name: 'double',
    returnType: types.int,
    parameters: [{ name: 'value', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
  })
  builder.setExport('math', 'double')
  builder.addClass('counter', { name: 'Counter', x: 420, y: 0 })
  builder.addVariable('counter', { name: 'value', type: types.int, initializer: drafts.literal(types.int, 0) }, { visibility: 'private' })
  builder.addConstructor('counter', {
    parameters: [{ name: 'start', type: types.int }],
    body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
  })
  builder.addMethod('counter', {
    name: 'increment',
    returnType: types.void,
    body: [drafts.assignment(
      drafts.member(drafts.thisExpression(), 'value'),
      drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
    )],
  })
  builder.addMethod('counter', {
    name: 'get',
    returnType: types.int,
    body: [drafts.returnStatement(drafts.member(drafts.thisExpression(), 'value'))],
  })
  builder.addModule('app', { name: 'App', x: 840, y: 0 })
  builder.addImport('app', { id: 'doubleImport', moduleId: 'math', nodeName: 'double', localName: 'double' })
  builder.addFunction('app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
      drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
      drafts.print(drafts.call(drafts.member(drafts.reference('counter'), 'get'), [])),
      drafts.print(drafts.call(drafts.importReference('doubleImport'), [drafts.literal(types.int, 21)])),
    ],
  })
  const result = builder.build()
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  return result.workspace
}

// Construit un workspace minimal valide avec une sortie déterministe.
function buildMinimalWorkspace() {
  const builder = createWorkspaceBuilder({ id: 'minimal' })
  builder.addModule('app', { name: 'App' })
  builder.addFunction('app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.print(drafts.literal(types.int, 42))],
  })
  const result = builder.build()
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  return result.workspace
}

test('project : version, création vide et séparation projet/workspace', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/project/package.json', import.meta.url), 'utf8'))
  assert.equal(PROJECT_VERSION, packageJson.version)
  assert.equal(PROJECT_API_VERSION, 1)
  assert.equal(WORKSPACE_VERSION, 3)
  assert.equal(PROJECT_FORMAT_VERSION, 1)

  const workspace = createWorkspace({ id: 'empty' })
  assert.equal(workspace.projectId, 'empty')
  assert.equal(workspace.workspaceVersion, 3)
  assert.equal(workspace.moduleCount, 0)
  assert.equal(workspace.cardCount, 0)
  assert.deepEqual(workspace.cards, [])
  assert.deepEqual(workspace.camera, { x: 0, y: 0, zoomLevel: 0 })
  assert.equal(workspace.selected, null)

  const text = workspace.toJSON()
  const document = JSON.parse(text)
  assert.equal(document.application, 'Sapphire 3')
  assert.equal(document.workspaceVersion, 3)
  assert.equal(document.project.formatVersion, 1)
  assert.deepEqual(document.presentation.cards, [])
  assert.deepEqual(deserializeWorkspace(text), document)
  assert.equal(loadProject(text).id, 'empty')
  assert.equal(serializeWorkspace(text), text)
  assert.equal(createEmptyWorkspace({ id: 'alias' }).projectId, 'alias')
  assert.equal(validateWorkspace(text).ok, true)

  const withMetadata = createWorkspace({ id: 'meta', metadata: { customRoot: 1 }, presentationMetadata: { customView: 'canvas' } })
  const metadataDocument = JSON.parse(withMetadata.toJSON())
  assert.equal(metadataDocument.customRoot, 1)
  assert.equal(metadataDocument.presentation.customView, 'canvas')
})

test('project : modules, classes, cartes, annotations et atomicité', () => {
  const base = createWorkspace({ id: 'cards' })
  let result = base.addModule({ id: 'app', name: 'App', x: 12, y: 34, width: 400, height: 260, emoji: 'A' })
  assert.equal(result.ok, true)
  let workspace = result.workspace
  assert.equal(workspace.getModule('app').kind, moduleKinds.module)
  assert.deepEqual(workspace.getCard('app'), {
    id: 'app', type: 'module', name: 'App', x: 12, y: 34, width: 400, height: 260, expandedNodeIds: [], emoji: 'A',
  })

  result = workspace.addClass({ id: 'counter', name: 'Counter', x: 500, y: 20 })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getModule('counter').kind, moduleKinds.class)
  assert.equal(workspace.getCard('counter').type, 'class')

  result = workspace.renameModule('app', 'Application')
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getModule('app').name, 'Application')
  assert.equal(workspace.getCard('app').name, 'Application')

  result = workspace.moveModule('app', { x: 640, y: 120, width: 420 })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual([workspace.getCard('app').x, workspace.getCard('app').y, workspace.getCard('app').width], [640, 120, 420])

  result = workspace.addComment({ id: 'note', text: 'Bonjour', x: 20, y: 500 })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getCard('note').type, 'comment')
  assert.equal(workspace.getCard('note').text, 'Bonjour')

  result = workspace.addImage({ id: 'pic', caption: 'Pixel', image: pngDataUrl, x: 500, y: 500 })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getCard('pic').type, 'image')
  assert.equal(workspace.getCard('pic').caption, 'Pixel')
  assert.equal(workspace.getCard('pic').image, pngDataUrl)

  const before = workspace.toJSON()
  assert.equal(workspace.addModule({ id: 'app', name: 'Duplicate' }).code, PROJECT_ERROR_CODES.duplicateId)
  assert.equal(workspace.addModule({ id: 'bad', name: 'Bad', width: 10 }).ok, false)
  assert.equal(workspace.renameModule('missing', 'Missing').code, PROJECT_ERROR_CODES.moduleNotFound)
  assert.equal(workspace.addImage({ id: 'unsafe', imageRef: '../secret.png' }).code, PROJECT_ERROR_CODES.imageInvalid)
  assert.equal(workspace.toJSON(), before)

  result = workspace.removeModule('counter')
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.moduleCount, 1)
  assert.equal(workspace.getCard('counter'), null)
  assert.equal(workspace.removeCard('note').ok, true)
  assert.equal(workspace.removeCard('note').workspace.getCard('note'), null)
  assert.equal(workspace.removeCard('app').code, PROJECT_ERROR_CODES.invalidArgument)
})

test('project : fonctions, nœuds, imports, exports et nettoyage de présentation', () => {
  const base = createWorkspace({ id: 'logic' })
  let result = base.addModule({ id: 'math', name: 'Math' })
  let workspace = result.workspace
  result = workspace.addModule({ id: 'app', name: 'App' })
  workspace = result.workspace

  result = workspace.addFunction('math', {
    name: 'double',
    returnType: types.int,
    parameters: [{ name: 'value', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
  })
  assert.equal(result.ok, true)
  const doubleId = result.nodeId
  workspace = result.workspace
  assert.equal(workspace.getNode(doubleId).properties.name, 'double')

  result = workspace.setExport('math', doubleId, true)
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual(workspace.getModule('math').exports, [{ nodeId: doubleId, name: 'double' }])
  result = workspace.setExport('math', doubleId, false)
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual(workspace.getModule('math').exports, [])
  result = workspace.setExport('math', doubleId, true)
  assert.equal(result.ok, true)
  workspace = result.workspace

  result = workspace.addFunction('app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.print(drafts.literal(types.int, 1))],
  })
  assert.equal(result.ok, true)
  const mainId = result.nodeId
  workspace = result.workspace
  const bodyId = workspace.getNode(mainId).children.body
  const printId = workspace.getNode(bodyId).children.statements[0]
  const printNode = workspace.getNode(printId)
  assert.equal(printNode.kind, 'PrintStatement')
  const literalId = printNode.children.value
  assert.equal(workspace.getNode(literalId).properties.value, 1)

  result = workspace.addImport('app', { id: 'doubleImport', moduleId: 'math', nodeId: doubleId, localName: 'double' })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual(workspace.getModule('app').imports, [{ id: 'doubleImport', moduleId: 'math', nodeId: doubleId, localName: 'double' }])
  result = workspace.removeImport('app', 'doubleImport')
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual(workspace.getModule('app').imports, [])

  result = workspace.updateNode(literalId, { properties: { type: types.int, value: 9 } })
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getNode(literalId).properties.value, 9)
  assert.deepEqual(simulateProgram(workspace.project).output, ['9'])

  result = workspace.updateCard('app', { expandedNodeIds: [printId] })
  assert.equal(result.ok, true)
  workspace = result.workspace
  result = workspace.setSelected({ kind: 'node', id: printId })
  assert.equal(result.ok, true)
  workspace = result.workspace
  result = workspace.deleteNode(printId)
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.equal(workspace.getNode(printId), null)
  assert.deepEqual(workspace.getCard('app').expandedNodeIds, [])
  assert.equal(workspace.selected, null)

  const before = workspace.toJSON()
  assert.equal(workspace.addFunction('missing', { name: 'x', returnType: types.void, body: [] }).code, 'TARGET_MISSING')
  assert.equal(workspace.addImport('app', { id: 'bad', moduleId: 'missing', nodeId: 'x', localName: 'x' }).ok, false)
  assert.equal(workspace.toJSON(), before)
})

test('project : builder déclaratif, classe, import et diagnostics associés', () => {
  const workspace = buildExampleWorkspace()
  assert.equal(workspace.moduleCount, 3)
  assert.equal(workspace.cardCount, 3)
  assert.deepEqual(workspace.cards.map((card) => card.type), ['module', 'class', 'module'])
  assert.equal(workspace.validate().ok, true)
  assert.deepEqual(simulateProgram(workspace.project).output, ['6', '42'])

  const text = workspace.toJSON()
  const reopened = loadWorkspace(text)
  assert.equal(reopened.toJSON(), text)
  assert.equal(reopened.validate().ok, true)
  assert.equal(reopened.getNodeId('math', 'double'), workspace.getNodeId('math', 'double'))
  assert.equal(validateProject(workspace.project).canGenerate, true)

  const broken = createWorkspaceBuilder({ id: 'broken' })
  broken.addModule('app', { name: 'App' })
  broken.addFunction('app', { name: 'helper', returnType: types.void, body: [drafts.print(drafts.reference('missing'))] })
  const invalid = broken.build()
  assert.equal(invalid.ok, false)
  assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.code === 'REFERENCE_UNRESOLVED' && diagnostic.object?.kind === 'node'))
  assert.throws(() => broken.buildOrThrow(), (error) => error instanceof ProjectError && error.code === 'REFERENCE_UNRESOLVED')
  assert.equal(broken.build({ requireValidProgram: false }).ok, true)
})

test('project : round-trip, métadonnées inconnues, exercice et dashboard', () => {
  const workspace = buildMinimalWorkspace()
  const text = workspace.toJSON()
  assert.equal(loadWorkspace(text).toJSON(), text)
  assert.deepEqual(loadWorkspace(text).toDocument(), deserializeWorkspace(text))
  assert.equal(serializeWorkspace(text), text)
  assert.equal(serializeProject(workspace), workspace.toProjectJSON())

  const document = JSON.parse(text)
  document.customRoot = { keep: true }
  document.presentation.customView = 'canvas'
  document.presentation.cards[0].customCard = 7
  document.project.modules[0].customModule = 'module-extra'
  document.project.nodes[0].customNode = 'node-extra'
  const preserved = loadWorkspace(JSON.stringify(document))
  const output = JSON.parse(preserved.toJSON())
  assert.deepEqual(output.customRoot, { keep: true })
  assert.equal(output.presentation.customView, 'canvas')
  assert.equal(output.presentation.cards[0].customCard, 7)
  assert.equal(output.project.modules[0].customModule, 'module-extra')
  assert.equal(output.project.nodes[0].customNode, 'node-extra')
  assert.equal(preserved.validate().structural.ok, true)

  let result = preserved.setExercise({ version: 1, title: 'Exercice', instructions: 'Faire', tests: [] })
  assert.equal(result.ok, true)
  result = result.workspace.setDashboard({ name: 'Demo', description: '', themeId: 'sapphire', palette: null, layoutKey: '' })
  assert.equal(result.ok, true)
  const withMeta = result.workspace
  const metaText = withMeta.toJSON()
  const meta = JSON.parse(metaText)
  assert.equal(meta.exercise.title, 'Exercice')
  assert.equal(meta.dashboard.name, 'Demo')
  assert.equal(loadWorkspace(metaText).toJSON(), metaText)
})

test('project : migrations version 1 et 2, versions futures et structures corrompues', () => {
  const current = JSON.parse(buildMinimalWorkspace().toJSON())
  const legacy = JSON.parse(JSON.stringify(current))
  legacy.workspaceVersion = 1
  legacy.presentation.cards[0].screenScale = 1.5
  const functionNode = legacy.project.nodes.find((node) => node.kind === 'FunctionDeclaration')
  functionNode.properties.generic = true
  delete functionNode.properties.typeParameters

  const migrated = loadWorkspace(JSON.stringify(legacy))
  assert.equal(migrated.workspaceVersion, 3)
  assert.deepEqual(migrated.getNode(functionNode.id).properties.typeParameters, [{ name: 'T' }])
  assert.equal(Object.hasOwn(migrated.getNode(functionNode.id).properties, 'generic'), false)
  assert.equal(Object.hasOwn(migrated.getCard('app'), 'screenScale'), false)

  const version2 = JSON.parse(JSON.stringify(current))
  version2.workspaceVersion = 2
  assert.equal(loadWorkspace(JSON.stringify(version2)).workspaceVersion, 3)

  const future = { ...current, workspaceVersion: 4 }
  assert.throws(() => loadWorkspace(JSON.stringify(future)), (error) => error.code === 'WORKSPACE_VERSION_UNSUPPORTED')
  assert.throws(() => loadWorkspace('not json'), (error) => error.code === 'WORKSPACE_JSON_INVALID')
  const mismatch = JSON.parse(JSON.stringify(current))
  mismatch.presentation.cards[0].name = 'Wrong'
  assert.throws(() => loadWorkspace(JSON.stringify(mismatch)), (error) => error.code === 'WORKSPACE_INVALID')
})

test('project : images, archives ZIP et conservation des fichiers annexes', () => {
  const base = buildMinimalWorkspace()
  let result = base.addImage({ id: 'pic', caption: 'Pixel', image: pngDataUrl, x: 420, y: 0 })
  assert.equal(result.ok, true)
  let workspace = result.workspace
  result = workspace.promoteEmbeddedImages()
  assert.equal(result.ok, true)
  workspace = result.workspace
  assert.deepEqual(result.promoted, [{ id: 'pic', reference: 'images/pic.png' }])
  assert.equal(workspace.getCard('pic').imageRef, 'images/pic.png')
  assert.equal(workspace.getCard('pic').image, '')
  assert.equal(workspace.getImageResource('images/pic.png').length > 0, true)

  result = workspace.setExtraFile('docs/note.txt', new TextEncoder().encode('bonjour'))
  assert.equal(result.ok, true)
  workspace = result.workspace
  const bytes = buildWorkspaceArchive(workspace)
  const entries = readWorkspaceZip(bytes)
  assert.deepEqual(entries.map((entry) => entry.name), ['workspace.sp3', 'images/pic.png', 'docs/note.txt'])
  const read = readWorkspaceArchive(bytes)
  assert.deepEqual(read.missingImages, [])
  assert.equal(read.workspace.getCard('pic').imageRef, 'images/pic.png')
  assert.equal(read.workspace.getImageResource('images/pic.png').length > 0, true)
  assert.equal(new TextDecoder().decode(read.workspace.getExtraFile('docs/note.txt')), 'bonjour')

  const missing = base.addImage({ id: 'missing', imageRef: 'images/missing.png' }).workspace
  assert.throws(() => buildWorkspaceArchive(missing), (error) => error.code === PROJECT_ERROR_CODES.imageMissing)
  const partial = buildWorkspaceArchive(missing, { strictImages: false })
  const partialRead = readWorkspaceArchive(partial, { strictImages: false })
  assert.deepEqual(partialRead.missingImages, ['images/missing.png'])

  const unsafeArchive = buildWorkspaceZip([
    { name: 'workspace.sp3', data: new TextEncoder().encode(base.toJSON()) },
    { name: 'C:/evil.txt', data: new TextEncoder().encode('x') },
  ])
  assert.throws(() => readWorkspaceArchive(unsafeArchive), (error) => error.code === PROJECT_ERROR_CODES.archiveUnsafeEntry)
})

test('project : adaptateurs de stockage sans système de fichiers', async () => {
  const workspace = buildExampleWorkspace()
  const storage = createMemoryStorage()
  const saved = await saveWorkspaceToStorage(storage, workspace)
  assert.equal(saved.path, 'workspace.sp3')
  assert.equal(storage.files.has('workspace.sp3'), true)
  const loaded = await loadWorkspaceFromStorage(storage)
  assert.equal(loaded.toJSON(), workspace.toJSON())

  const image = baseImageWorkspace()
  const imageStorage = createMemoryStorage()
  const bundle = await saveWorkspaceBundle(imageStorage, image)
  assert.deepEqual(bundle.writtenImages, ['images/pic.png'])
  assert.equal(imageStorage.files.has('images/pic.png'), true)
  const bundleRead = await loadWorkspaceBundle(imageStorage, { strictImages: true })
  assert.deepEqual(bundleRead.missingImages, [])
  assert.equal(bundleRead.workspace.getImageResource('images/pic.png').length > 0, true)

  const archiveStorage = createMemoryStorage()
  const archive = await exportWorkspaceArchiveToStorage(archiveStorage, image, { path: 'workspace.zip' })
  assert.equal(archive.path, 'workspace.zip')
  const archiveRead = await loadWorkspaceArchiveFromStorage(archiveStorage, { path: 'workspace.zip', strictImages: true })
  assert.equal(archiveRead.workspace.getCard('pic').imageRef, 'images/pic.png')
  assert.equal(archiveRead.workspace.getImageResource('images/pic.png').length > 0, true)

  await assert.rejects(() => loadWorkspaceFromStorage({}), (error) => error.code === PROJECT_ERROR_CODES.storageUnavailable)
  const missingStorage = createMemoryStorage({ 'workspace.sp3': image.toJSON() })
  await assert.rejects(() => loadWorkspaceBundle(missingStorage, { strictImages: true }), (error) => error.code === PROJECT_ERROR_CODES.imageMissing)
  const missingBundle = await loadWorkspaceBundle(missingStorage)
  assert.deepEqual(missingBundle.missingImages, ['images/pic.png'])
})

// Construit un workspace avec une image liée et ses octets.
function baseImageWorkspace() {
  const base = buildMinimalWorkspace()
  const result = base.addImage({ id: 'pic', caption: 'Pixel', image: pngDataUrl, x: 420, y: 0 })
  assert.equal(result.ok, true)
  return result.workspace.promoteEmbeddedImages().workspace
}

test('project : ouverture par le chargeur de l’application desktop', () => {
  const workspace = buildExampleWorkspace()
  const appWorkspace = deserializeWorkspace(workspace.toJSON())
  assert.equal(appWorkspace.application, 'Sapphire 3')
  assert.equal(appWorkspace.workspaceVersion, 3)
  assert.equal(appWorkspace.project.modules.length, 3)
  assert.equal(appWorkspace.presentation.cards.length, 3)
  const document = reduceDocument(initialDocument(), { type: 'replaceWorkspace', workspace: appWorkspace })
  assert.equal(document.project.id, 'agent-demo')
  assert.equal(document.cards.length, 3)
  assert.deepEqual(simulateProgram(document.project).output, ['6', '42'])
  const reopened = deserializeWorkspace(serializeAppWorkspace(document.project, document.cards, { x: 0, y: 0, zoomLevel: 0 }, null, document.exercise, document.dashboard))
  assert.equal(reopened.project.modules.length, 3)
  assert.equal(reopened.presentation.cards.length, 3)
})

test('project : erreurs typées, atomicité et associations d’objets', () => {
  const workspace = buildMinimalWorkspace()
  const before = workspace.toJSON()
  const cases = [
    workspace.updateCard('missing', {}),
    workspace.addFunction('missing', { name: 'x', returnType: types.void, body: [] }),
    workspace.setCamera({ x: 0, y: 0, zoomLevel: 99 }),
    workspace.setSelected({ kind: 'module', id: 'missing' }),
    workspace.setExercise({}),
    workspace.setDashboard({}),
    workspace.addImage({ id: 'unsafe', imageRef: '../secret.png' }),
    workspace.setImageResource('../secret.png', new Uint8Array([1])),
    workspace.setExtraFile('images/unsafe', new Uint8Array([1])),
  ]
  assert.ok(cases.every((result) => result.ok === false && result.workspace === workspace))
  assert.ok(cases.every((result) => result.object && typeof result.object.kind === 'string'))
  assert.equal(workspace.toJSON(), before)
  assert.throws(() => assertWorkspaceResult(cases[0]), (error) => isProjectError(error) && error.code === PROJECT_ERROR_CODES.cardNotFound)
  assert.equal(isProjectError(new ProjectError('X', 'x')), true)
  assert.deepEqual(new ProjectError('X', 'x', { object: { kind: 'node', id: 'n' } }).toJSON().object, { kind: 'node', id: 'n' })
  assert.equal(validateWorkspace(workspace.toJSON()).structural.ok, true)
  assert.equal(validateProject({ formatVersion: 1, id: 'bad', modules: [], nodes: [] }).canGenerate, true)
})
