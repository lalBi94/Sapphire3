import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex, getModuleLinks } from '../../src/utils/logic/index.js'
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
