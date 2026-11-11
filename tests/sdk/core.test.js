import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import {
  SDK_API_VERSION,
  SDK_VERSION,
  SapphireError,
  addClass,
  addConstructor,
  addFunction,
  addImport,
  addMethod,
  addModule,
  addVariable,
  analyze,
  assertResult,
  assertValid,
  createProject,
  deleteNode,
  deserializeProject,
  drafts,
  duplicateNode,
  getModuleInfo,
  getReferencesTo,
  inspectNode,
  renameSymbol,
  serializeProject,
  setExport,
  summarize,
  types,
  validate,
} from '../../packages/core/src/index.js'

test('SDK : version du package et contrat public', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/core/package.json', import.meta.url), 'utf8'))
  assert.equal(SDK_VERSION, packageJson.version)
  assert.equal(SDK_API_VERSION, 1)
})

// Construit une fonction d'entrée minimale qui affiche une valeur.
function entryProject() {
  const empty = createProject('sdk-test')
  const withModule = addModule(empty, { id: 'app', name: 'App' })
  assert.equal(withModule.ok, true)
  const withMain = addFunction(withModule.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('answer', types.int, drafts.literal(types.int, 42)),
      drafts.print(drafts.reference('answer')),
    ],
  })
  assert.equal(withMain.ok, true, withMain.code)
  return withMain
}

test('SDK : création, analyse, symboles et inspection', () => {
  const result = entryProject()
  assert.equal(result.analysis.canGenerate, true)
  assert.deepEqual(result.analysis.diagnostics, [])
  const names = result.analysis.symbols.map((symbol) => symbol.name)
  assert.ok(names.includes('main'))
  assert.ok(names.includes('answer'))
  assert.equal(validate(result.project).ok, true)

  const main = inspectNode(result.project, result.nodeId)
  assert.equal(main.node.kind, 'FunctionDeclaration')
  assert.equal(main.parent.kind, 'module')
  assert.equal(main.type.kind, 'function')
  assert.equal(main.type.returnType.name, 'void')

  const printNode = result.project.nodes.find((node) => node.kind === 'PrintStatement')
  const printInspection = inspectNode(result.project, printNode.id)
  assert.equal(printInspection.parent.kind, 'node')
  assert.equal(printInspection.parent.slot, 'statements')

  const answer = result.project.nodes.find((node) => node.kind === 'VariableDeclaration' && node.properties.name === 'answer')
  const answerSymbol = result.analysis.symbols.find((symbol) => symbol.nodeId === answer.id)
  assert.ok(answerSymbol)
  assert.equal(getReferencesTo(result.analysis, answer.id).length, 1)
})

test('SDK : renommage, suppression et duplication', () => {
  const project = entryProject().project
  const double = addFunction(project, 'app', {
    name: 'doubleIt',
    returnType: types.int,
    parameters: [{ name: 'value', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
  })
  assert.equal(double.ok, true, double.code)
  const parameter = double.project.nodes.find((node) => node.id === double.nodeId).children.parameters[0]
  const renamed = renameSymbol(double.project, parameter, 'x')
  assert.equal(renamed.ok, true, renamed.code)
  assert.ok(renamed.changes.some((change) => change.kind === 'declaration' && change.to === 'x'))
  assert.ok(renamed.changes.some((change) => change.kind === 'reference' && change.to === 'x'))
  assert.equal(renamed.analysis.canGenerate, true)

  const deleted = deleteNode(renamed.project, double.nodeId)
  assert.equal(deleted.ok, true, deleted.code)
  assert.ok(deleted.removedNodeIds.includes(double.nodeId))
  assert.equal(deleted.project.nodes.some((node) => node.id === double.nodeId), false)

  const duplicated = duplicateNode(double.project, double.nodeId)
  assert.equal(duplicated.ok, true, duplicated.code)
  const functions = duplicated.project.nodes.filter((node) => node.kind === 'FunctionDeclaration').map((node) => node.properties.name)
  assert.ok(functions.includes('doubleIt'))
  assert.ok(functions.includes('doubleIt2'))
})

test('SDK : classes, constructeur, méthode et intégration à la transpilation', () => {
  const empty = createProject('sdk-class')
  const withClass = addClass(empty, { id: 'counter', name: 'Counter' })
  assert.equal(withClass.ok, true, withClass.code)
  const withField = addVariable(withClass.project, 'counter', {
    name: 'value',
    type: types.int,
    initializer: drafts.literal(types.int, 0),
  }, { visibility: 'public' })
  assert.equal(withField.ok, true, withField.code)
  const withConstructor = addConstructor(withField.project, 'counter', {
    parameters: [{ name: 'start', type: types.int }],
    body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
    visibility: 'public',
  })
  assert.equal(withConstructor.ok, true, withConstructor.code)
  const withMethod = addMethod(withConstructor.project, 'counter', {
    name: 'increment',
    returnType: types.void,
    body: [drafts.assignment(
      drafts.member(drafts.thisExpression(), 'value'),
      drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
    )],
  }, { visibility: 'public' })
  assert.equal(withMethod.ok, true, withMethod.code)
  const withApp = addModule(withMethod.project, { id: 'app', name: 'App' })
  const withMain = addFunction(withApp.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
      drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
      drafts.print(drafts.member(drafts.reference('counter'), 'value')),
    ],
  })
  assert.equal(withMain.ok, true, withMain.code)
  assert.equal(withMain.analysis.canGenerate, true)
  assert.deepEqual(withMain.analysis.diagnostics, [])
  assert.deepEqual(simulateProgram(withMain.project).output, ['6'])
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(withMain.project, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
  }
  const info = getModuleInfo(withMain.project, 'counter')
  assert.ok(info.members.some((member) => member.name === 'increment'))
  assert.ok(info.members.some((member) => member.name === 'constructor'))
  assert.equal(info.constructor.name, 'constructor')
})

test('SDK : imports, exports et appel intermodule', () => {
  const empty = createProject('sdk-imports')
  const withLib = addModule(empty, { id: 'lib', name: 'Lib' })
  const withSquare = addFunction(withLib.project, 'lib', {
    name: 'square',
    returnType: types.int,
    parameters: [{ name: 'value', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.reference('value')))],
  })
  assert.equal(withSquare.ok, true, withSquare.code)
  const exported = setExport(withSquare.project, 'lib', withSquare.nodeId, true)
  assert.equal(exported.ok, true, exported.code)
  const withApp = addModule(exported.project, { id: 'app', name: 'App' })
  const imported = addImport(withApp.project, 'app', {
    id: 'squareImport',
    moduleId: 'lib',
    nodeId: withSquare.nodeId,
    localName: 'square',
  })
  assert.equal(imported.ok, true, imported.code)
  const withMain = addFunction(imported.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.print(drafts.call(drafts.importReference('squareImport'), [drafts.literal(types.int, 7)]))],
  })
  assert.equal(withMain.ok, true, withMain.code)
  assert.equal(withMain.analysis.canGenerate, true)
  assert.deepEqual(simulateProgram(withMain.project).output, ['49'])
  assert.equal(getModuleInfo(withMain.project, 'lib').exports.length, 1)
  assert.equal(getModuleInfo(withMain.project, 'app').imports[0].localName, 'square')
})

test('SDK : sérialisation logique et erreurs structurées', () => {
  const result = entryProject()
  const serialized = serializeProject(result.project)
  assert.equal(serialized.ok, true)
  assert.equal(typeof serialized.json, 'string')
  const deserialized = deserializeProject(serialized.json)
  assert.equal(deserialized.ok, true)
  assert.equal(deserialized.analysis.canGenerate, true)
  assert.deepEqual(summarize(deserialized.project), summarize(result.project))

  const broken = deserializeProject('{')
  assert.equal(broken.ok, false)
  assert.equal(broken.code, 'SERIALIZATION_INVALID')

  const invalid = addModule(createProject('invalid'), { id: 'app', name: 'App' }).project
  invalid.modules[0].rootNodeIds.push('missing')
  assert.throws(() => assertValid(invalid), (error) => error instanceof SapphireError && error.code === 'SDK_PROGRAM_INVALID')

  const failed = addFunction(result.project, 'missing', {
    name: 'nope',
    returnType: types.void,
    body: [],
  })
  assert.equal(failed.ok, false)
  assert.throws(() => assertResult(failed), (error) => error instanceof SapphireError && error.code === 'TARGET_MISSING')
})
