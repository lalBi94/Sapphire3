import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeProgram,
  deleteSourceTargets,
  duplicateSourceTargets,
  moveSourceNodes,
} from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

// Produit des identifiants déterministes pour les tests de duplication.
function ids(prefix = 'new') {
  let value = 0
  return () => `${prefix}${++value}`
}

// Retrouve un nœud source par identifiant.
function sourceNode(project, id) {
  return project.nodes.find((entry) => entry.id === id)
}

test('sélection : suppression groupée de modules et de nœuds sans double retrait', () => {
  const source = program('left', 'right')
  root(source, 'left', 'leftValue', 'VariableDeclaration', { name: 'leftValue', type: intType }, { initializer: 'one' })
  node(source, 'left', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'right', 'rightValue', 'VariableDeclaration', { name: 'rightValue', type: intType }, { initializer: 'two' })
  node(source, 'right', 'two', 'Literal', { type: intType, value: 2 })

  const result = deleteSourceTargets(source, [
    { kind: 'module', id: 'left' },
    { kind: 'node', id: 'rightValue' },
  ])
  assert.equal(result.ok, true)
  assert.deepEqual(result.removedModuleIds, ['left'])
  assert.deepEqual(result.removedNodeIds, ['rightValue', 'two'])
  assert.equal(result.project.modules.some((module) => module.id === 'left'), false)
  assert.equal(sourceNode(result.project, 'rightValue'), undefined)
  assert.equal(sourceNode(result.project, 'two'), undefined)
  assert.equal(analyzeProgram(result.project).diagnostics.some((entry) => entry.severity === 'error'), false)
})

test('sélection : suppression d’un parent et de son enfant ne retire l’enfant qu’une fois', () => {
  const source = program('m')
  root(source, 'm', 'outer', 'FunctionDeclaration', { name: 'outer', type: intType }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['returnValue'] })
  node(source, 'm', 'returnValue', 'ReturnStatement', {}, { argument: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })

  const result = deleteSourceTargets(source, [
    { kind: 'node', id: 'outer' },
    { kind: 'node', id: 'one' },
  ])
  assert.equal(result.ok, true)
  assert.deepEqual(result.removedNodeIds.sort(), ['body', 'one', 'outer', 'returnValue'].sort())
  assert.equal(result.project.nodes.length, 0)
})

test('sélection : duplication de plusieurs nœuds, sans copie en double d’un descendant', () => {
  const source = program('m')
  root(source, 'm', 'a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'one' })
  root(source, 'm', 'b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'two' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })

  const result = duplicateSourceTargets(source, [
    { kind: 'node', id: 'a' },
    { kind: 'node', id: 'b' },
    { kind: 'node', id: 'one' },
  ], { idFactory: ids() })
  assert.equal(result.ok, true)
  assert.equal(result.duplicatedNodeIds.length, 2)
  assert.equal(result.project.nodes.length, 8)
  assert.equal(result.project.modules[0].rootNodeIds.length, 4)
  assert.equal(analyzeProgram(result.project).diagnostics.some((entry) => entry.severity === 'error'), false)
})

test('sélection : duplication d’un module remappe exports, imports et point d’entrée', () => {
  const source = program('lib', 'app')
  root(source, 'lib', 'start', 'FunctionDeclaration', { name: 'start', type: intType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'lib', 'body', 'Block', {}, { statements: ['returnValue'] })
  node(source, 'lib', 'returnValue', 'ReturnStatement', {}, { argument: 'one' })
  node(source, 'lib', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'lib', 'useHelper', 'VariableDeclaration', { name: 'useHelper', type: intType }, { initializer: 'helperCall' })
  node(source, 'lib', 'helperCall', 'CallExpression', {}, { callee: 'helperCallee', arguments: [] })
  node(source, 'lib', 'helperCallee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'helperImport' } })
  source.modules[0].exports.push({ nodeId: 'start', name: 'start' })
  source.modules[0].imports.push({ id: 'helperImport', moduleId: 'app', nodeId: 'helper', localName: 'helperImport' })

  root(source, 'app', 'helper', 'FunctionDeclaration', { name: 'helper', type: intType }, { parameters: [], body: 'helperBody' })
  node(source, 'app', 'helperBody', 'Block', {}, { statements: ['helperReturn'] })
  node(source, 'app', 'helperReturn', 'ReturnStatement', {}, { argument: 'two' })
  node(source, 'app', 'two', 'Literal', { type: intType, value: 2 })
  source.modules[1].exports.push({ nodeId: 'helper', name: 'helper' })
  source.modules[1].imports.push({ id: 'startImport', moduleId: 'lib', nodeId: 'start', localName: 'start' })

  const result = duplicateSourceTargets(source, [{ kind: 'module', id: 'lib' }], { idFactory: ids('copy') })
  assert.equal(result.ok, true)
  assert.equal(result.duplicatedModules.length, 1)
  const duplicate = result.project.modules.find((module) => module.id === result.duplicatedModules[0].moduleId)
  assert.equal(duplicate.name, 'lib 2')
  assert.notEqual(duplicate.id, 'lib')
  assert.equal(duplicate.exports[0].name, 'start')
  assert.notEqual(duplicate.exports[0].nodeId, 'start')
  const copiedStart = sourceNode(result.project, duplicate.exports[0].nodeId)
  assert.equal(copiedStart.properties.entryPoint, false)
  assert.equal(duplicate.imports.length, 1)
  assert.notEqual(duplicate.imports[0].id, 'helperImport')
  const copiedHelperRef = sourceNode(result.project, result.duplicatedModules[0].nodeIdMap.helperCallee)
  assert.equal(copiedHelperRef.references.target.importId, duplicate.imports[0].id)
  assert.equal(sourceNode(result.project, 'start').properties.entryPoint, true)
  assert.equal(analyzeProgram(result.project).diagnostics.some((entry) => entry.severity === 'error'), false)
})

test('sélection : déplacement groupé vers une liste multiple', () => {
  const source = program('left', 'right')
  root(source, 'left', 'a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'one' })
  root(source, 'left', 'b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'two' })
  node(source, 'left', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'left', 'two', 'Literal', { type: intType, value: 2 })

  const result = moveSourceNodes(source, ['a', 'b'], { kind: 'module', id: 'right' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.project.modules.find((module) => module.id === 'right').rootNodeIds, ['a', 'b'])
  assert.deepEqual(result.project.modules.find((module) => module.id === 'left').rootNodeIds, [])
  assert.equal(result.index.nodes.get('a').moduleId, 'right')
  assert.equal(result.index.nodes.get('b').moduleId, 'right')
})

test('sélection : un déplacement groupé refusé ne laisse aucune mutation partielle', () => {
  const source = program('m')
  root(source, 'm', 'print', 'PrintStatement', {}, { value: null })
  root(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  root(source, 'm', 'two', 'Literal', { type: intType, value: 2 })

  const result = moveSourceNodes(source, ['one', 'two'], { kind: 'node', id: 'print' })
  assert.equal(result.ok, false)
  assert.equal(sourceNode(source, 'one').moduleId, 'm')
  assert.equal(sourceNode(source, 'two').moduleId, 'm')
  assert.equal(sourceNode(source, 'print').children.value, null)
})
