import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, simulateProgram, createDebugSession, getMathNative, mathNativeIds, getNodeSchema } from '../../src/utils/logic/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const doubleType = { kind: 'primitive', name: 'double' }

// Compose une fonction d'entrée qui évalue une opération mathématique dans une expression.
function entryProgram(name, argumentIds = []) {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['stmt'] })
  node(source, 'm', 'stmt', 'ExpressionStatement', {}, { expression: 'call' })
  node(source, 'm', 'call', 'MathCall', { name }, { arguments: argumentIds })
  return source
}

// Initialise une variable d'entrée avec une opération mathématique pour observer son résultat.
function variableProgram(name, resultType, argumentIds) {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['decl'] })
  node(source, 'm', 'decl', 'VariableDeclaration', { name: 'r', type: resultType }, { initializer: 'call' })
  node(source, 'm', 'call', 'MathCall', { name }, { arguments: argumentIds })
  return source
}

// Ajoute un littéral typé au programme.
function literal(source, id, type, value) {
  node(source, 'm', id, 'Literal', { type, value })
}

test('opérations mathématiques : le registre est cohérent et expose les fonctions attendues', () => {
  for (const id of ['abs', 'min', 'max', 'pow', 'sqrt', 'sin', 'cos', 'tan', 'floor', 'ceil', 'round']) {
    assert.ok(mathNativeIds.includes(id), `${id} doit être proposé`)
  }
  for (const id of mathNativeIds) {
    const definition = getMathNative(id)
    assert.equal(definition.id, id)
    assert.ok(Array.isArray(definition.parameters))
    assert.ok(definition.returnType)
    assert.equal(typeof definition.run, 'function')
  }
  assert.equal(getMathNative('unknown'), null)
  assert.equal(getNodeSchema('MathCall').group, 'native', 'le nœud reste une opération native')
})

test('opérations mathématiques : un appel valide est typé, un nom ou une arité invalide est refusé', () => {
  const valid = entryProgram('min', ['a', 'b'])
  literal(valid, 'a', intType, '2')
  literal(valid, 'b', intType, '3')
  const analysis = analyzeProgram(valid)
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'call')?.type, intType)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])

  const unknown = entryProgram('nope')
  assert.ok(analyzeProgram(unknown).diagnostics.map((entry) => entry.code).includes('NODE_INCOMPLETE'))

  const wrongArity = entryProgram('min', ['a'])
  literal(wrongArity, 'a', intType, '2')
  assert.ok(analyzeProgram(wrongArity).diagnostics.map((entry) => entry.code).includes('TYPE_MISMATCH'))

  const wrongType = entryProgram('min', ['a', 'b'])
  literal(wrongType, 'a', doubleType, '2.0')
  literal(wrongType, 'b', intType, '3')
  assert.ok(analyzeProgram(wrongType).diagnostics.map((entry) => entry.code).includes('TYPE_MISMATCH'))
})

test('opérations mathématiques : min, max et abs s’exécutent sur les entiers', () => {
  const source = variableProgram('max', intType, ['outer', 'five'])
  node(source, 'm', 'outer', 'MathCall', { name: 'min' }, { arguments: ['two', 'three'] })
  literal(source, 'two', intType, '2')
  literal(source, 'three', intType, '3')
  literal(source, 'five', intType, '5')
  const result = simulateProgram(source)
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.variables.find((entry) => entry.name === 'r').value, '5')

  const absolute = variableProgram('abs', intType, ['negative'])
  literal(absolute, 'negative', intType, '-4')
  const absResult = simulateProgram(absolute)
  assert.equal(absResult.ok, true, absResult.errorCode)
  assert.equal(absResult.variables.find((entry) => entry.name === 'r').value, '4')
})

test('opérations mathématiques : puissances et trigonométrie renvoient des doubles finis', () => {
  const power = variableProgram('pow', doubleType, ['base', 'exponent'])
  literal(power, 'base', doubleType, '2.0')
  literal(power, 'exponent', doubleType, '3.0')
  const powerResult = simulateProgram(power)
  assert.equal(powerResult.ok, true, powerResult.errorCode)
  assert.equal(powerResult.variables.find((entry) => entry.name === 'r').value, '8')

  const sine = variableProgram('sin', doubleType, ['zero'])
  literal(sine, 'zero', doubleType, '0.0')
  const sineResult = simulateProgram(sine)
  assert.equal(sineResult.ok, true, sineResult.errorCode)
  assert.equal(sineResult.variables.find((entry) => entry.name === 'r').value, '0')
})

test('opérations mathématiques : un résultat non fini arrête la simulation avec un code stable', () => {
  const source = variableProgram('sqrt', doubleType, ['negative'])
  literal(source, 'negative', doubleType, '-1.0')
  const result = simulateProgram(source)
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'SIMULATION_MATH_DOMAIN')
})

test('opérations mathématiques : le débogage expose un arrêt sans erreur', () => {
  const source = entryProgram('floor', ['value'])
  literal(source, 'value', doubleType, '2.7')
  const session = createDebugSession(source)
  assert.ok(session.frames.length > 0)
  assert.equal(session.errorCode, null)
})
