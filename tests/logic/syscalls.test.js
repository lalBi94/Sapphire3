import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, simulateProgram, createDebugSession, getSyscall, syscallIds, getNodeSchema, createContextIndex, getAvailableActions } from '../../src/utils/logic/index.js'
import { program, root, node, intType, stringType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Programme minimal : une fonction d'entrée contenant un appel système à une expression donnée.
function entryProgram(name, argumentIds = []) {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['stmt'] })
  node(source, 'm', 'stmt', 'ExpressionStatement', {}, { expression: 'call' })
  node(source, 'm', 'call', 'SystemCall', { name }, { arguments: argumentIds })
  return source
}

test('appels système : le registre est cohérent et reproductible', () => {
  assert.ok(syscallIds.includes('write') && syscallIds.includes('tick'))
  for (const id of syscallIds) {
    const definition = getSyscall(id)
    assert.equal(definition.id, id)
    assert.ok(Array.isArray(definition.parameters))
    assert.ok(definition.returnType)
  }
  assert.equal(getSyscall('unknown'), null)
  assert.equal(getNodeSchema('SystemCall').group, 'native', 'les appels système sont des opérations natives')
  assert.equal(getNodeSchema('PrintStatement').group, 'native', 'print est aussi une opération native SP3')
  assert.deepEqual(['abs', 'min', 'max'].map((id) => getSyscall(id).group), ['native.math', 'native.math', 'native.math'], 'les natives mathématiques forment une sous-catégorie')
  assert.equal(getSyscall('tick').run({ args: [], steps: 7 }), getSyscall('tick').run({ args: [], steps: 7 }))
})

test('appels système : un appel valide est typé, un nom ou une arité invalide est refusé', () => {
  const valid = entryProgram('write', ['lit'])
  node(valid, 'm', 'lit', 'Literal', { type: stringType, value: 'hello' })
  const validAnalysis = analyzeProgram(valid)
  assert.deepEqual(validAnalysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'call')?.type, intType)
  assert.deepEqual(validAnalysis.diagnostics.filter((entry) => entry.severity === 'error'), [])

  const unknown = entryProgram('nope')
  assert.ok(analyzeProgram(unknown).diagnostics.map((entry) => entry.code).includes('NODE_INCOMPLETE'))

  const wrongArity = entryProgram('write')
  assert.ok(analyzeProgram(wrongArity).diagnostics.map((entry) => entry.code).includes('TYPE_MISMATCH'))
})

test('appels système : write alimente la sortie et tick renvoie l’horloge simulée', () => {
  const write = entryProgram('write', ['lit'])
  node(write, 'm', 'lit', 'Literal', { type: stringType, value: 'hello' })
  const written = simulateProgram(write)
  assert.equal(written.ok, true)
  assert.deepEqual(written.output, ['hello'])

  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['decl'] })
  node(source, 'm', 'decl', 'VariableDeclaration', { name: 'y', type: intType }, { initializer: 'call' })
  node(source, 'm', 'call', 'SystemCall', { name: 'tick' }, { arguments: [] })
  const ticked = simulateProgram(source)
  assert.equal(ticked.ok, true)
  assert.equal(ticked.variables.find((entry) => entry.name === 'y').value, String(ticked.steps))
})

test('appels système : le débogage expose un arrêt sans erreur', () => {
  const write = entryProgram('write', ['lit'])
  node(write, 'm', 'lit', 'Literal', { type: stringType, value: 'hi' })
  const session = createDebugSession(write)
  assert.ok(session.frames.length > 0)
  assert.equal(session.errorCode, null)
})

test('natives mathématiques : abs, min et max sont exécutées sans conversion implicite', () => {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['a', 'b', 'c'] })
  node(source, 'm', 'a', 'VariableDeclaration', { name: 'a', type: intType }, { initializer: 'absCall' })
  node(source, 'm', 'absCall', 'SystemCall', { name: 'abs' }, { arguments: ['neg'] })
  node(source, 'm', 'neg', 'Literal', { type: intType, value: -5 })
  node(source, 'm', 'b', 'VariableDeclaration', { name: 'b', type: intType }, { initializer: 'minCall' })
  node(source, 'm', 'minCall', 'SystemCall', { name: 'min' }, { arguments: ['three', 'seven'] })
  node(source, 'm', 'three', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'seven', 'Literal', { type: intType, value: 7 })
  node(source, 'm', 'c', 'VariableDeclaration', { name: 'c', type: intType }, { initializer: 'maxCall' })
  node(source, 'm', 'maxCall', 'SystemCall', { name: 'max' }, { arguments: ['three2', 'seven2'] })
  node(source, 'm', 'three2', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'seven2', 'Literal', { type: intType, value: 7 })
  assert.deepEqual(analyzeProgram(source).diagnostics.filter((entry) => entry.severity === 'error'), [])
  const result = simulateProgram(source)
  assert.equal(result.ok, true)
  const value = (name) => result.variables.find((entry) => entry.name === name)?.value
  assert.equal(value('a'), '5')
  assert.equal(value('b'), '3')
  assert.equal(value('c'), '7')
})

test('natives : le menu propose chaque appel dans sa catégorie ou sous-catégorie', () => {
  const source = program('m')
  root(source, 'm', 'x', 'VariableDeclaration', { name: 'x', type: intType }, { initializer: null })
  const index = createContextIndex(source, analyzeProgram(source))
  const actions = getAvailableActions(source, 'x', 'initializer', { index }).actions
  assert.deepEqual(actions.filter((action) => action.group === 'native.math').map((action) => action.preset.name), ['abs', 'min', 'max'])
  assert.ok(actions.some((action) => action.kind === 'SystemCall' && action.group === 'native' && action.preset.name === 'write'))
  assert.equal(actions.some((action) => action.kind === 'SystemCall' && !action.preset), false, 'aucune entrée générique ne double les appels')
})
