import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeProgram, createContextIndex, getVisibleSymbols, resolveContext,
  getImportCandidates, getModuleFunctions, setModuleExport, addModuleImport, removeModuleImport, simulateProgram,
  getCallableSymbols, ensureModuleImports,
  diagnosticCodes as codes,
} from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Prépare une fonction exportable dans un module et un point d'entrée qui l'importerait.
function twoFunctions() {
  const source = program('lib', 'app')
  root(source, 'lib', 'plus1', 'FunctionDeclaration', { name: 'plus1', type: intType }, { parameters: ['p'], body: 'libBody' })
  node(source, 'lib', 'p', 'Parameter', { name: 'p', type: intType })
  node(source, 'lib', 'libBody', 'Block', {}, { statements: ['returnSum'] })
  node(source, 'lib', 'returnSum', 'ReturnStatement', {}, { argument: 'sum' })
  node(source, 'lib', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'pRef', right: 'one' })
  node(source, 'lib', 'pRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'p' } })
  node(source, 'lib', 'one', 'Literal', { type: intType, value: 1 })

  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'app', 'mainBody', 'Block', {}, { statements: ['print'] })
  node(source, 'app', 'print', 'PrintStatement', {}, { value: 'call' })
  node(source, 'app', 'call', 'CallExpression', {}, { callee: 'callee', arguments: ['argument'] })
  node(source, 'app', 'callee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'plus1Import' } })
  node(source, 'app', 'argument', 'Literal', { type: intType, value: 41 })
  return source
}

test('interface : export explicite, import créé avec l’export manquant et appel simulé', () => {
  const source = twoFunctions()
  const index = createContextIndex(source, analyzeProgram(source))
  const mainBody = resolveContext(source, { kind: 'node', id: 'mainBody' }, undefined, index)
  assert.ok(!getVisibleSymbols(mainBody).some((symbol) => symbol.name === 'plus1'))

  const exported = setModuleExport(source, 'lib', 'plus1', true)
  assert.equal(exported.ok, true)
  assert.deepEqual(exported.project.modules[0].exports, [{ nodeId: 'plus1', name: 'plus1' }])
  assert.deepEqual(source.modules[0].exports, [])

  const imported = addModuleImport(source, 'app', { id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName: 'plus1' })
  assert.equal(imported.ok, true)
  assert.deepEqual(imported.project.modules[1].imports, [{ id: 'plus1Import', moduleId: 'lib', nodeId: 'plus1', localName: 'plus1' }])
  assert.deepEqual(imported.project.modules[0].exports, [{ nodeId: 'plus1', name: 'plus1' }])
  const importedBody = resolveContext(imported.project, { kind: 'node', id: 'mainBody' }, undefined, imported.index)
  assert.ok(getVisibleSymbols(importedBody).some((symbol) => symbol.name === 'plus1' && symbol.importedFrom === 'lib'))
  assert.equal(imported.analysis.diagnostics.some((diagnostic) => diagnostic.code === codes.invalidImport), false)
  assert.deepEqual(simulateProgram(imported.project).output, ['42'])
})

test('interface : candidats limités aux fonctions des autres modules', () => {
  const source = twoFunctions()
  assert.deepEqual(getModuleFunctions(source, 'lib').map((symbol) => symbol.name), ['plus1'])
  assert.deepEqual(getImportCandidates(source, 'app').map((entry) => [entry.moduleName, entry.name]), [['lib', 'plus1']])
  assert.deepEqual(getImportCandidates(source, 'lib').map((entry) => [entry.moduleName, entry.name]), [['app', 'main']])
  const imported = addModuleImport(source, 'app', { id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName: 'plus1' })
  assert.deepEqual(getImportCandidates(imported.project, 'app'), [])
})

test('interface : imports en double ou renommés vers un nom pris sont refusés', () => {
  const source = twoFunctions()
  const imported = addModuleImport(source, 'app', { id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName: 'plus1' })
  assert.equal(imported.ok, true)
  assert.equal(addModuleImport(imported.project, 'app', { id: 'other', targetModuleId: 'lib', nodeId: 'plus1', localName: 'other' }).code, 'IMPORT_ALREADY_EXISTS')
  assert.equal(addModuleImport(source, 'app', { id: 'mainImport', targetModuleId: 'lib', nodeId: 'plus1', localName: 'main' }).code, 'IMPORT_NAME_TAKEN')
  assert.equal(addModuleImport(source, 'app', { id: 'selfImport', targetModuleId: 'app', nodeId: 'main', localName: 'start' }).code, 'IMPORT_TARGET_INVALID')
  assert.equal(addModuleImport(source, 'app', { id: 'missing', targetModuleId: 'lib', nodeId: 'absent', localName: 'absent' }).code, 'IMPORT_TARGET_INVALID')
  assert.equal(addModuleImport(source, 'app', { id: 'notFunction', targetModuleId: 'lib', nodeId: 'p', localName: 'p' }).code, 'IMPORT_TARGET_INVALID')
})

test('interface : un export utilisé ne peut pas être retiré et un export valide reste réversible', () => {
  const source = twoFunctions()
  const exported = setModuleExport(source, 'lib', 'plus1', true)
  const imported = addModuleImport(exported.project, 'app', { id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName: 'plus1' })
  assert.equal(setModuleExport(imported.project, 'lib', 'plus1', false).code, 'EXPORT_IN_USE')
  assert.equal(setModuleExport(source, 'lib', 'p', true).code, codes.invalidExport)
  assert.equal(setModuleExport(source, 'lib', 'nope', true).code, codes.invalidExport)
  const removed = setModuleExport(exported.project, 'lib', 'plus1', false)
  assert.equal(removed.ok, true)
  assert.deepEqual(removed.project.modules[0].exports, [])
})

test('interface : retirer un import supprime la liaison sans effacer la déclaration', () => {
  const source = twoFunctions()
  const imported = addModuleImport(source, 'app', { id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName: 'plus1' })
  const removed = removeModuleImport(imported.project, 'app', 'plus1Import')
  assert.equal(removed.ok, true)
  assert.deepEqual(removed.project.modules[1].imports, [])
  assert.ok(removed.project.nodes.some((entry) => entry.id === 'plus1'))
  assert.equal(removeModuleImport(imported.project, 'app', 'missing').code, 'TARGET_MISSING')
})

test('appels : une fonction exportée est proposée sans import local, puis importée à l’usage', () => {
  const source = twoFunctions()
  const exported = setModuleExport(source, 'lib', 'plus1', true).project
  const index = createContextIndex(exported, analyzeProgram(exported))
  const context = resolveContext(exported, { kind: 'node', id: 'mainBody' }, undefined, index)
  const callables = getCallableSymbols(context)
  const external = callables.find((symbol) => symbol.name === 'plus1')
  assert.equal(external?.external, true)
  assert.equal(external?.moduleName, 'lib')
  assert.equal(getVisibleSymbols(context).some((symbol) => symbol.name === 'plus1'), false)

  const call = { references: { target: { kind: 'node', nodeId: 'plus1' } } }
  const ensured = ensureModuleImports(exported, 'app', [call])
  assert.equal(ensured.ok, true)
  assert.equal(ensured.imported, true)
  assert.equal(ensured.project.modules[1].imports[0].nodeId, 'plus1')
  assert.equal(ensured.project.modules[1].imports[0].localName, 'plus1')
  assert.equal(ensureModuleImports(ensured.project, 'app', [call]).imported, false)
  assert.equal(analyzeProgram(ensured.project).diagnostics.some((diagnostic) => diagnostic.code === codes.invalidImport), false)
})

test('appels : un import automatique ne vise qu’une fonction exportée et évite les noms pris', () => {
  const source = twoFunctions()
  assert.equal(ensureModuleImports(source, 'app', [{ references: { target: { kind: 'node', nodeId: 'plus1' } } }]).code, 'IMPORT_TARGET_INVALID')
  const exported = setModuleExport(source, 'lib', 'plus1', true).project
  const renamed = { ...exported, nodes: exported.nodes.map((entry) => entry.id === 'main' ? { ...entry, properties: { ...entry.properties, name: 'plus1' } } : entry) }
  const ensured = ensureModuleImports(renamed, 'app', [{ references: { target: { kind: 'node', nodeId: 'plus1' } } }])
  assert.equal(ensured.ok, true)
  assert.equal(ensured.project.modules[1].imports[0].localName, 'plus12')
})

test('appels : un import automatique rend l’appel simulable', () => {
  const source = structuredClone(twoFunctions())
  const exported = setModuleExport(source, 'lib', 'plus1', true).project
  const callee = exported.nodes.find((entry) => entry.id === 'callee')
  callee.references.target = { kind: 'node', nodeId: 'plus1' }
  const ensured = ensureModuleImports(exported, 'app', [callee])
  assert.equal(ensured.ok, true)
  const result = simulateProgram(ensured.project)
  assert.deepEqual(result.output, ['42'])
  assert.equal(result.errorCode ?? null, null)
})
