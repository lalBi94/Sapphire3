import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, getUnusedDeclarationIds } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Un module avec une variable utilisée, une variable morte, une fonction privée morte,
// une fonction exportée et un point d'entrée : seules les deux déclarations mortes sont signalées.
function declarationsProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['used', 'print'] })
  node(source, 'm', 'used', 'VariableDeclaration', { name: 'used', type: intType }, { initializer: 'one' })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'print', 'PrintStatement', {}, { value: 'usedRef' })
  node(source, 'm', 'usedRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'used' } })
  root(source, 'm', 'dead', 'VariableDeclaration', { name: 'dead', type: intType }, { initializer: 'two' })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  root(source, 'm', 'helper', 'FunctionDeclaration', { name: 'helper', type: voidType }, { parameters: [], body: 'helperBody' })
  node(source, 'm', 'helperBody', 'Block', {}, { statements: [] })
  root(source, 'm', 'publicApi', 'FunctionDeclaration', { name: 'publicApi', type: voidType }, { parameters: [], body: 'apiBody' })
  node(source, 'm', 'apiBody', 'Block', {}, { statements: [] })
  source.modules[0].exports.push({ nodeId: 'publicApi', name: 'publicApi' })
  return source
}

test('déclarations inutilisées : seules les privées jamais référencées sont signalées', () => {
  const project = declarationsProgram()
  const unused = getUnusedDeclarationIds(project, analyzeProgram(project))
  assert.deepEqual(unused.sort(), ['dead', 'helper'])
  assert.ok(!unused.includes('used'), 'une variable référencée reste utilisée')
  assert.ok(!unused.includes('main'), 'le point d’entrée est utilisé par définition')
  assert.ok(!unused.includes('publicApi'), 'une fonction exportée fait partie de l’interface publique')
})

test('déclarations inutilisées : un paramètre et un type ne sont jamais signalés', () => {
  const project = declarationsProgram()
  root(project, 'm', 'worker', 'FunctionDeclaration', { name: 'worker', type: voidType }, { parameters: ['unusedParam'], body: 'workerBody' })
  node(project, 'm', 'unusedParam', 'Parameter', { name: 'unusedParam', type: intType })
  node(project, 'm', 'workerBody', 'Block', {}, { statements: [] })
  root(project, 'm', 'Alias', 'TypeDeclaration', { name: 'Alias', type: intType })
  const unused = getUnusedDeclarationIds(project, analyzeProgram(project))
  assert.ok(!unused.includes('unusedParam'))
  assert.ok(!unused.includes('Alias'))
  assert.ok(unused.includes('worker'), 'la fonction privée jamais appelée reste signalée')
})

test('déclarations inutilisées : une fonction appelée depuis un autre module est utilisée', () => {
  const source = program('lib', 'app')
  root(source, 'lib', 'square', 'FunctionDeclaration', { name: 'square', type: intType }, { parameters: ['n'], body: 'squareBody' })
  node(source, 'lib', 'n', 'Parameter', { name: 'n', type: intType })
  node(source, 'lib', 'squareBody', 'Block', {}, { statements: ['returnN'] })
  node(source, 'lib', 'returnN', 'ReturnStatement', {}, { argument: 'nRef' })
  node(source, 'lib', 'nRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'n' } })
  source.modules[0].exports.push({ nodeId: 'square', name: 'square' })
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'app', 'body', 'Block', {}, { statements: ['print'] })
  node(source, 'app', 'print', 'PrintStatement', {}, { value: 'call' })
  node(source, 'app', 'call', 'CallExpression', {}, { callee: 'callee', arguments: ['two'] })
  node(source, 'app', 'callee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'squareImport' } })
  node(source, 'app', 'two', 'Literal', { type: intType, value: 2 })
  source.modules[1].imports.push({ id: 'squareImport', moduleId: 'lib', nodeId: 'square', localName: 'square' })
  const unused = getUnusedDeclarationIds(source, analyzeProgram(source))
  assert.ok(!unused.includes('square'), 'un export réellement appelé ailleurs est utilisé')
  assert.ok(unused.includes('nRef') === false, 'le paramètre n’est pas une déclaration signalée')
})
