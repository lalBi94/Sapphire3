import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addModuleImport, analyzeProgram, renameSourceSymbol, setModuleExport, simulateProgram,
} from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Prépare une bibliothèque exportée et un module appelant qui l'importe sous un nom choisi.
function importedFunction(localName = 'plus1') {
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
  node(source, 'app', 'callee', 'Reference', {}, {}, { target: { kind: 'name', name: localName } })
  node(source, 'app', 'argument', 'Literal', { type: intType, value: 41 })

  const exported = setModuleExport(source, 'lib', 'plus1', true)
  assert.equal(exported.ok, true)
  const imported = addModuleImport(exported.project, 'app', {
    id: 'plus1Import', targetModuleId: 'lib', nodeId: 'plus1', localName,
  })
  assert.equal(imported.ok, true)
  return imported.project
}

// Retrouve un nœud source par son identifiant sans dépendre du rendu.
function sourceNode(project, id) {
  return project.nodes.find((entry) => entry.id === id)
}

test('renommage : une portée locale ne touche pas une déclaration homonyme ailleurs', () => {
  const source = program('m')
  root(source, 'm', 'first', 'FunctionDeclaration', { name: 'first', type: intType }, { parameters: ['firstParameter'], body: 'firstBody' })
  node(source, 'm', 'firstParameter', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'firstBody', 'Block', {}, { statements: ['firstReturn'] })
  node(source, 'm', 'firstReturn', 'ReturnStatement', {}, { argument: 'firstRef' })
  node(source, 'm', 'firstRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })

  root(source, 'm', 'second', 'FunctionDeclaration', { name: 'second', type: intType }, { parameters: ['secondParameter'], body: 'secondBody' })
  node(source, 'm', 'secondParameter', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'secondBody', 'Block', {}, { statements: ['secondReturn'] })
  node(source, 'm', 'secondReturn', 'ReturnStatement', {}, { argument: 'secondRef' })
  node(source, 'm', 'secondRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })

  const result = renameSourceSymbol(source, 'firstParameter', 'input')
  assert.equal(result.ok, true)
  assert.equal(sourceNode(result.project, 'firstParameter').properties.name, 'input')
  assert.equal(sourceNode(result.project, 'firstRef').references.target.name, 'input')
  assert.equal(sourceNode(result.project, 'secondParameter').properties.name, 'value')
  assert.equal(sourceNode(result.project, 'secondRef').references.target.name, 'value')
  assert.equal(analyzeProgram(result.project).diagnostics.some((diagnostic) => diagnostic.severity === 'error'), false)
})

test('renommage : une fonction exportée met à jour références, import local et export', () => {
  const source = importedFunction()
  const result = renameSourceSymbol(source, 'plus1', 'increment')
  assert.equal(result.ok, true)
  assert.equal(sourceNode(result.project, 'plus1').properties.name, 'increment')
  assert.equal(sourceNode(result.project, 'callee').references.target.name, 'increment')
  assert.equal(result.project.modules.find((module) => module.id === 'app').imports[0].localName, 'increment')
  assert.deepEqual(result.project.modules.find((module) => module.id === 'lib').exports, [{ nodeId: 'plus1', name: 'increment' }])
  assert.deepEqual(simulateProgram(result.project).output, ['42'])
  assert.deepEqual(result.changes.map((change) => change.kind), ['declaration', 'export', 'import', 'reference'])
})

test('renommage : un alias d’import personnalisé reste inchangé', () => {
  const source = importedFunction('sum')
  const result = renameSourceSymbol(source, 'plus1', 'increment')
  assert.equal(result.ok, true)
  assert.equal(sourceNode(result.project, 'callee').references.target.name, 'sum')
  assert.equal(result.project.modules.find((module) => module.id === 'app').imports[0].localName, 'sum')
  assert.deepEqual(result.project.modules.find((module) => module.id === 'lib').exports, [{ nodeId: 'plus1', name: 'increment' }])
  assert.deepEqual(simulateProgram(result.project).output, ['42'])
})

test('renommage : une annotation de type suit le renommage de son alias', () => {
  const source = program('m')
  root(source, 'm', 'Count', 'TypeDeclaration', { name: 'Count', type: intType })
  root(source, 'm', 'value', 'VariableDeclaration', { name: 'value', type: { kind: 'named', target: { kind: 'name', name: 'Count' } } }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })

  const result = renameSourceSymbol(source, 'Count', 'Total')
  assert.equal(result.ok, true)
  assert.equal(sourceNode(result.project, 'Count').properties.name, 'Total')
  assert.equal(sourceNode(result.project, 'value').properties.type.target.name, 'Total')
  assert.deepEqual(result.changes.map((change) => change.kind), ['declaration', 'type'])
  assert.equal(analyzeProgram(result.project).diagnostics.some((diagnostic) => diagnostic.code === 'REFERENCE_UNRESOLVED'), false)
})

test('renommage : une collision de nom est refusée sans modifier la source', () => {
  const source = program('m')
  root(source, 'm', 'left', 'VariableDeclaration', { name: 'left', type: intType }, { initializer: 'one' })
  root(source, 'm', 'right', 'VariableDeclaration', { name: 'right', type: intType }, { initializer: 'two' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })

  const result = renameSourceSymbol(source, 'left', 'right')
  assert.equal(result.ok, false)
  assert.equal(result.code, 'RENAME_INVALID')
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'DECLARATION_CONFLICT'))
  assert.equal(sourceNode(source, 'left').properties.name, 'left')
  assert.equal(sourceNode(source, 'right').properties.name, 'right')
})

test('renommage : une référence sans lien préalable ne doit pas être rebasculée par hasard', () => {
  const source = program('m')
  root(source, 'm', 'target', 'FunctionDeclaration', { name: 'target', type: intType }, { parameters: [], body: 'targetBody' })
  node(source, 'm', 'targetBody', 'Block', {}, { statements: ['targetReturn'] })
  node(source, 'm', 'targetReturn', 'ReturnStatement', {}, { argument: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'other', 'FunctionDeclaration', { name: 'other', type: voidType }, { parameters: [], body: 'otherBody' })
  node(source, 'm', 'otherBody', 'Block', {}, { statements: ['print'] })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'missingRef' })
  node(source, 'm', 'missingRef', 'Reference', {}, {}, { target: { kind: 'name', name: 'renamed' } })

  const result = renameSourceSymbol(source, 'target', 'renamed')
  assert.equal(result.ok, false)
  assert.equal(result.code, 'RENAME_REBIND')
  assert.deepEqual(result.reboundNodeIds, ['missingRef'])
})

test('renommage : un nom identique produit un aperçu vide', () => {
  const source = importedFunction()
  const result = renameSourceSymbol(source, 'plus1', 'plus1')
  assert.equal(result.ok, true)
  assert.deepEqual(result.changes, [])
  assert.equal(result.project, source)
})
