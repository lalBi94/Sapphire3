import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, simulateProgram, createDebugSession, getMathNative, mathNativeIds, getNodeSchema } from '../../src/utils/logic/index.js'
import { program, root, node, intType, stringType, booleanType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const doubleType = { kind: 'primitive', name: 'double' }
const charType = { kind: 'primitive', name: 'char' }

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

// Compose un tableau d'entiers puis sa longueur, pour vérifier le paramètre générique.
function arrayLengthProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['values', 'result'] })
  node(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: { kind: 'array', elementType: intType } }, { initializer: 'items' })
  node(source, 'm', 'items', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  literal(source, 'one', intType, '1')
  literal(source, 'two', intType, '2')
  literal(source, 'three', intType, '3')
  node(source, 'm', 'result', 'VariableDeclaration', { name: 'r', type: intType }, { initializer: 'call' })
  node(source, 'm', 'call', 'MathCall', { name: 'arrayLength' }, { arguments: ['arrayReference'] })
  node(source, 'm', 'arrayReference', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  return source
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
  assert.equal(getMathNative('randomDouble').parameters.length, 0)
  assert.deepEqual(getMathNative('randomDouble').returnType, doubleType)
  assert.deepEqual(getMathNative('randomInt').parameters, [intType, intType])
  assert.deepEqual(getMathNative('randomInt').returnType, intType)
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

test('opérations natives : le registre expose les maths, le texte et les tableaux', () => {
  for (const id of ['clamp', 'sign', 'gcd', 'lerp', 'log', 'length', 'charAt', 'substring', 'contains', 'arrayLength']) {
    assert.ok(mathNativeIds.includes(id), `${id} doit être proposé`)
    const definition = getMathNative(id)
    assert.ok(definition.group.startsWith('native.'), `${id} doit avoir une sous-catégorie`)
    assert.equal(typeof definition.run, 'function')
  }
  assert.equal(getMathNative('length').group, 'native.text')
  assert.equal(getMathNative('arrayLength').group, 'native.arrays')
  assert.equal(getMathNative('arrayLength').parameters[0].kind, 'array')
  assert.equal(getMathNative('arrayLength').parameters[0].elementType, null, 'le tableau reste générique')
})

test('opérations aléatoires : double dans [0, 1) et entier dans une plage inclusive', () => {
  const doubleSource = variableProgram('randomDouble', doubleType, [])
  const doubleResult = simulateProgram(doubleSource)
  assert.equal(doubleResult.ok, true, doubleResult.errorCode)
  const doubleValue = Number(doubleResult.variables.find((entry) => entry.name === 'r').value)
  assert.ok(doubleValue >= 0 && doubleValue < 1, `double hors plage : ${doubleValue}`)

  const intSource = variableProgram('randomInt', intType, ['min', 'max'])
  literal(intSource, 'min', intType, '1')
  literal(intSource, 'max', intType, '6')
  const intResult = simulateProgram(intSource)
  assert.equal(intResult.ok, true, intResult.errorCode)
  const intValue = Number(intResult.variables.find((entry) => entry.name === 'r').value)
  assert.ok(Number.isInteger(intValue) && intValue >= 1 && intValue <= 6, `entier hors plage : ${intValue}`)

  const invalid = variableProgram('randomInt', intType, ['min', 'max'])
  literal(invalid, 'min', intType, '5')
  literal(invalid, 'max', intType, '1')
  assert.equal(simulateProgram(invalid).errorCode, 'SIMULATION_RANDOM_RANGE')
})

test('opérations de grille : remplissage, convolution, table de transition et blit écran', () => {
  const fill = getMathNative('arrayFill')
  const convolve = getMathNative('arrayConvolve')
  const lookup = getMathNative('arrayLookup')
  const blit = getMathNative('screenBlit')
  const present = getMathNative('screenPresent')
  assert.ok(fill && convolve && lookup && blit && present)

  assert.deepEqual(fill.run([4, 7]).map(Number), [7, 7, 7, 7])

  const counts = convolve.run([[0, 0, 0, 0, 1, 0, 0, 0, 0], 3, 3, [1, 1, 1, 1, 0, 1, 1, 1, 1], 3, 3])
  assert.deepEqual(counts.map(Number), [1, 1, 1, 1, 0, 1, 1, 1, 1])

  const next = lookup.run([
    [0, 0, 0, 0, 3, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  ])
  assert.deepEqual(next.map(Number), [0, 0, 0, 0, 1, 0, 0, 0, 0])

  const pixels = new Array(3 * 3 * 4).fill(0n)
  const palette = [0, 0, 0, 0, 255, 213, 71, 255]
  blit.run([pixels, 3, 3, [0, 1, 0, 1, 1, 1, 0, 0, 0], 3, 3, palette])
  assert.deepEqual(pixels.slice(4, 8).map(Number), [255, 213, 71, 255])
  assert.deepEqual(pixels.slice(0, 4).map(Number), [0, 0, 0, 0])
  assert.equal(present.run([]), undefined)
})

test('opérations de texte : longueur, caractère, portion et recherche', () => {
  const length = variableProgram('length', intType, ['text'])
  literal(length, 'text', stringType, 'héllo')
  const lengthResult = simulateProgram(length)
  assert.equal(lengthResult.ok, true, lengthResult.errorCode)
  assert.equal(lengthResult.variables.find((entry) => entry.name === 'r').value, '5')

  const character = variableProgram('charAt', charType, ['text', 'index'])
  literal(character, 'text', stringType, 'héllo')
  literal(character, 'index', intType, '1')
  const characterResult = simulateProgram(character)
  assert.equal(characterResult.ok, true, characterResult.errorCode)
  assert.equal(characterResult.variables.find((entry) => entry.name === 'r').value, 'é')

  const slice = variableProgram('substring', stringType, ['text', 'start', 'end'])
  literal(slice, 'text', stringType, 'héllo')
  literal(slice, 'start', intType, '1')
  literal(slice, 'end', intType, '3')
  const sliceResult = simulateProgram(slice)
  assert.equal(sliceResult.ok, true, sliceResult.errorCode)
  assert.equal(sliceResult.variables.find((entry) => entry.name === 'r').value, 'él')

  const search = variableProgram('contains', booleanType, ['text', 'part'])
  literal(search, 'text', stringType, 'hello')
  literal(search, 'part', stringType, 'ell')
  const searchResult = simulateProgram(search)
  assert.equal(searchResult.ok, true, searchResult.errorCode)
  assert.equal(searchResult.variables.find((entry) => entry.name === 'r').value, 'true')
})

test('opérations natives : bornes de texte refusées avec un code stable', () => {
  const index = variableProgram('charAt', charType, ['text', 'position'])
  literal(index, 'text', stringType, 'abc')
  literal(index, 'position', intType, '3')
  const indexResult = simulateProgram(index)
  assert.equal(indexResult.ok, false)
  assert.equal(indexResult.errorCode, 'SIMULATION_STRING_BOUNDS')

  const slice = variableProgram('substring', stringType, ['text', 'start', 'end'])
  literal(slice, 'text', stringType, 'abc')
  literal(slice, 'start', intType, '2')
  literal(slice, 'end', intType, '1')
  const sliceResult = simulateProgram(slice)
  assert.equal(sliceResult.ok, false)
  assert.equal(sliceResult.errorCode, 'SIMULATION_STRING_BOUNDS')
})

test('opérations mathématiques ajoutées : bornage, signe, PGCD, interpolation et logarithme', () => {
  const cases = [
    ['clamp', intType, ['above', 'zero', 'ten'], ['12', '0', '10'], '10'],
    ['sign', intType, ['negative'], ['-7'], '-1'],
    ['gcd', intType, ['a', 'b'], ['12', '18'], '6'],
    ['lerp', doubleType, ['start', 'end', 'half'], ['0.0', '10.0', '0.5'], '5'],
    ['log', doubleType, ['one'], ['1.0'], '0'],
  ]
  for (const [name, resultType, ids, values, expected] of cases) {
    const source = variableProgram(name, resultType, ids)
    ids.forEach((id, index) => literal(source, id, resultType, values[index]))
    const result = simulateProgram(source)
    assert.equal(result.ok, true, `${name}: ${result.errorCode}`)
    assert.equal(result.variables.find((entry) => entry.name === 'r').value, expected, name)
  }

  const domain = variableProgram('log', doubleType, ['zero'])
  literal(domain, 'zero', doubleType, '0.0')
  const domainResult = simulateProgram(domain)
  assert.equal(domainResult.ok, false)
  assert.equal(domainResult.errorCode, 'SIMULATION_MATH_DOMAIN')
})

test('opérations de tableaux : arrayLength type et exécute un tableau générique', () => {
  const source = arrayLengthProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'call')?.type, intType)
  const result = simulateProgram(source)
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.variables.find((entry) => entry.name === 'r').value, '3')

  const wrong = entryProgram('arrayLength', ['number'])
  literal(wrong, 'number', intType, '4')
  assert.ok(analyzeProgram(wrong).diagnostics.map((entry) => entry.code).includes('TYPE_MISMATCH'))
})

test('opérations natives : le débogage expose un arrêt sans erreur', () => {
  const source = entryProgram('floor', ['value'])
  literal(source, 'value', doubleType, '2.7')
  const session = createDebugSession(source)
  assert.ok(session.frames.length > 0)
  assert.equal(session.errorCode, null)
})

