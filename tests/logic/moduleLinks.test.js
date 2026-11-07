import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, createModule, getModuleLinks } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Construit un exportateur et un récepteur, avec ou sans utilisation réelle de l'import.
function linked({ used = true, localName = 'answer' } = {}) {
  const source = program('math', 'app')
  root(source, 'math', 'answer', 'ConstantDeclaration', { name: 'answer', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'math', 'fortyTwo', 'Literal', { value: 42, type: intType })
  source.modules[0].exports.push({ nodeId: 'answer', name: 'answer' })
  if (used) source.modules[1].imports.push({ id: 'answerImport', moduleId: 'math', nodeId: 'answer', localName })
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'app', 'mainBody', 'Block', {}, { statements: used ? ['print'] : [] })
  node(source, 'app', 'print', 'PrintStatement', {}, { value: 'answerReference' })
  node(source, 'app', 'answerReference', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })
  return getModuleLinks(createContextIndex(source, analyzeProgram(source)))
}

test('liens : une flèche part de l’exportateur vers le module qui utilise réellement l’exportation', () => {
  const links = linked()
  assert.equal(links.length, 1)
  assert.deepEqual(links[0], {
    id: 'math::app',
    fromId: 'math',
    toId: 'app',
    fromName: 'math',
    toName: 'app',
    exports: [{ nodeId: 'answer', name: 'answer', localName: 'answer', uses: 1 }],
  })
})

test('liens : un import jamais référencé ne produit aucune flèche', () => {
  const source = program('math', 'app')
  root(source, 'math', 'answer', 'ConstantDeclaration', { name: 'answer', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'math', 'fortyTwo', 'Literal', { value: 42, type: intType })
  source.modules[0].exports.push({ nodeId: 'answer', name: 'answer' })
  source.modules[1].imports.push({ id: 'answerImport', moduleId: 'math', nodeId: 'answer', localName: 'answer' })
  const links = getModuleLinks(createContextIndex(source, analyzeProgram(source)))
  assert.deepEqual(links, [])
  assert.deepEqual(linked({ used: false }), [])
})

test('liens : le nom local et le nombre d’utilisations suivent les références résolues', () => {
  const source = program('math', 'app')
  root(source, 'math', 'answer', 'ConstantDeclaration', { name: 'answer', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'math', 'fortyTwo', 'Literal', { value: 42, type: intType })
  source.modules[0].exports.push({ nodeId: 'answer', name: 'answer' })
  source.modules[1].imports.push({ id: 'answerImport', moduleId: 'math', nodeId: 'answer', localName: 'reponse' })
  root(source, 'app', 'first', 'VariableDeclaration', { name: 'first', type: intType }, { initializer: 'referenceOne' })
  node(source, 'app', 'referenceOne', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })
  root(source, 'app', 'second', 'VariableDeclaration', { name: 'second', type: intType }, { initializer: 'referenceTwo' })
  node(source, 'app', 'referenceTwo', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })

  const [link] = getModuleLinks(createContextIndex(source, analyzeProgram(source)))
  assert.equal(link.exports.length, 1)
  assert.deepEqual(link.exports[0], { nodeId: 'answer', name: 'answer', localName: 'reponse', uses: 2 })
})

test('liens : aucun index ni analyse incomplet ne produit de flèche', () => {
  assert.deepEqual(getModuleLinks(null), [])
  assert.deepEqual(getModuleLinks({ modules: new Map(), analysis: null }), [])
})

test('liens : une classe instanciée ou utilisée comme type produit une flèche depuis sa carte', () => {
  const source = program('counter', 'app')
  source.modules[0] = createModule('counter', 'Counter', 'class')
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'app', 'mainBody', 'Block', {}, { statements: ['declaration'] })
  node(source, 'app', 'declaration', 'VariableDeclaration', { name: 'c', type: { kind: 'class', classId: 'counter' } }, { initializer: 'instance' })
  node(source, 'app', 'instance', 'NewExpression', { classId: 'counter' }, { arguments: [] })

  const links = getModuleLinks(createContextIndex(source, analyzeProgram(source)))
  assert.equal(links.length, 1)
  assert.equal(links[0].fromId, 'counter')
  assert.equal(links[0].toId, 'app')
  assert.equal(links[0].fromName, 'Counter')
  assert.deepEqual(links[0].exports, [{ nodeId: 'class:counter', name: 'Counter', localName: '', uses: 2 }])
})

test('liens : une classe qui utilise une exportation produit la flèche vers sa carte', () => {
  const source = program('provider', 'consumer')
  source.modules[1] = createModule('consumer', 'Consumer', 'class')
  root(source, 'provider', 'show', 'FunctionDeclaration', { name: 'show', type: voidType }, { parameters: [], body: 'showBody' })
  node(source, 'provider', 'showBody', 'Block', {}, { statements: [] })
  source.modules[0].exports.push({ nodeId: 'show', name: 'show' })
  source.modules[1].imports.push({ id: 'showImport', moduleId: 'provider', nodeId: 'show', localName: 'show' })
  root(source, 'consumer', 'publish', 'FunctionDeclaration', { name: 'publish', type: voidType }, { parameters: [], body: 'publishBody' })
  node(source, 'consumer', 'publishBody', 'Block', {}, { statements: ['callStatement'] })
  node(source, 'consumer', 'callStatement', 'ExpressionStatement', {}, { expression: 'callExpression' })
  node(source, 'consumer', 'callExpression', 'CallExpression', {}, { callee: 'calleeReference', arguments: [] })
  node(source, 'consumer', 'calleeReference', 'Reference', {}, {}, { target: { kind: 'import', importId: 'showImport' } })

  const links = getModuleLinks(createContextIndex(source, analyzeProgram(source)))
  assert.equal(links.length, 1)
  assert.equal(links[0].fromId, 'provider')
  assert.equal(links[0].toId, 'consumer')
  assert.deepEqual(links[0].exports, [{ nodeId: 'show', name: 'show', localName: 'show', uses: 1 }])
})
