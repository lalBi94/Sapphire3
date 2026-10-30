import test from 'node:test'
import assert from 'node:assert/strict'
import * as engine from '../../src/utils/logic/index.js'
import { program, node, root } from './fixtures.js'

const { analyzeProgram, primitiveType, primitiveDefinitions, diagnosticCodes: codes } = engine

// Produit une expression littérale avec un type écrit dans la source, sans inférence de test.
function literalProgram(name, value) {
  const source = program('m')
  root(source, 'm', 'value', 'ConstantDeclaration', { name: 'value', type: { kind: 'primitive', name } }, { initializer: 'literal' })
  node(source, 'm', 'literal', 'Literal', { value, type: { kind: 'primitive', name } })
  return source
}

// Prépare une opération binaire dont chaque opérande porte son annotation propre.
function binaryProgram(name, operator, left, right, resultName = name, rightName = name) {
  const source = program('m')
  root(source, 'm', 'value', 'VariableDeclaration', { name: 'value', type: primitiveType(resultName) }, { initializer: 'operation' })
  node(source, 'm', 'operation', 'BinaryExpression', { operator }, { left: 'left', right: 'right' })
  node(source, 'm', 'left', 'Literal', { value: left, type: primitiveType(name) })
  node(source, 'm', 'right', 'Literal', { value: right, type: primitiveType(rightName) })
  return source
}

// Prépare une conversion explicite sans altérer le type du littéral d'origine.
function castProgram(from, to, value) {
  const source = program('m')
  root(source, 'm', 'value', 'VariableDeclaration', { name: 'value', type: primitiveType(to) }, { initializer: 'cast' })
  node(source, 'm', 'cast', 'CastExpression', { type: primitiveType(to) }, { argument: 'literal' })
  node(source, 'm', 'literal', 'Literal', { value, type: primitiveType(from) })
  return source
}

// Prépare une fonction avec signature explicite et corps vide à compléter dans le scénario.
function functionProgram(resultName, parameters = []) {
  const source = program('m')
  root(source, 'm', 'f', 'FunctionDeclaration', { name: 'f', type: primitiveType(resultName) }, { parameters: parameters.map((_, index) => `p${index}`), body: 'body' })
  parameters.forEach((name, index) => node(source, 'm', `p${index}`, 'Parameter', { name: `p${index}`, type: primitiveType(name) }))
  node(source, 'm', 'body', 'Block', {}, { statements: [] })
  return source
}

// Ajoute un retour au corps principal en gardant l'imbrication explicite.
function addReturn(source, name, value) {
  source.nodes.find((entry) => entry.id === 'body').children.statements.push('return')
  node(source, 'm', 'return', 'ReturnStatement', {}, name ? { argument: 'returned' } : {})
  if (name) node(source, 'm', 'returned', 'Literal', { value, type: primitiveType(name) })
}

// Affiche les diagnostics en cas de régression d'un exemple censé être entièrement valide.
function valid(source) {
  const result = analyzeProgram(source)
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.canGenerate, true)
  return result
}

// Vérifie une erreur précise, sa localisation et le refus de validation du programme.
function invalid(source, code, id) {
  const result = analyzeProgram(source)
  assert.equal(result.canGenerate, false)
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.location.nodeId === id), JSON.stringify(result.diagnostics))
  return result
}

test('catalogue exclusif : dix primitifs et aucun type de secours public', () => {
  assert.deepEqual(Object.keys(primitiveDefinitions), ['short int', 'short uint', 'int', 'uint', 'float', 'double', 'string', 'char', 'boolean', 'void'])
  assert.equal(Object.hasOwn(engine, 'unknownType'), false)
  assert.equal(primitiveDefinitions['short int'].bits, 16)
  assert.equal(primitiveDefinitions.uint.bits, 32)
  assert.equal(primitiveDefinitions.float.bits, 32)
  assert.equal(primitiveDefinitions.double.bits, 64)
  assert.equal(primitiveType('__proto__'), null)
})

for (const [name, minimum, maximum] of [
  ['short int', -32768, 32767], ['short uint', 0, 65535],
  ['int', -2147483648, 2147483647], ['uint', 0, 4294967295],
]) {
  test(`${name} : bornes exactes, zéros et dépassements des deux côtés`, () => {
    for (const value of [minimum, maximum, 0, String(minimum), String(maximum)]) valid(literalProgram(name, value))
    for (const value of [minimum - 1, maximum + 1, String(minimum - 1), String(maximum + 1)]) invalid(literalProgram(name, value), codes.overflow, 'literal')
    invalid(literalProgram(name, '999999999999999999999999999999999'), codes.overflow, 'literal')
    invalid(literalProgram(name, 1.5), codes.invalidLiteral, 'literal')
    invalid(literalProgram(name, '1e2'), codes.invalidLiteral, 'literal')
  })
}

for (const name of ['number', 'any', 'unknown']) {
  test(`ancien type ${name} rejeté et jamais publié dans les types résolus`, () => {
    const source = literalProgram(name, 1)
    const snapshot = JSON.stringify(source)
    const result = invalid(source, codes.invalidType, 'value')
    assert.equal(result.semantic.nodeTypes.length, 0)
    assert.ok(result.semantic.symbols.every((symbol) => !Object.hasOwn(symbol, 'type')))
    assert.ok(result.semantic.untypedNodeIds.includes('literal'))
    assert.equal(JSON.stringify(source), snapshot)
  })
}

test('annotation obligatoire sur variable, constante, fonction, paramètre et littéral', () => {
  for (const kind of ['VariableDeclaration', 'ConstantDeclaration']) {
    const source = literalProgram('int', 1)
    source.nodes[0].kind = kind
    delete source.nodes[0].properties.type
    const result = invalid(source, codes.typeRequired, 'value')
    assert.equal(Object.hasOwn(result.semantic.symbols[0], 'type'), false)
  }
  const literal = literalProgram('boolean', true)
  delete literal.nodes[1].properties.type
  invalid(literal, codes.typeRequired, 'literal')
  for (const id of ['f', 'p0']) {
    const source = functionProgram('int', ['int'])
    addReturn(source, 'int', 1)
    delete source.nodes.find((entry) => entry.id === id).properties.type
    invalid(source, codes.typeRequired, id)
  }
})

test('primitives et alias malformés restent représentables sans inventer un type', () => {
  for (const type of [{ kind: 'unknown' }, {}, { kind: 'primitive', name: 'constructor' }, false, [], 'int']) {
    const source = literalProgram('int', 1)
    source.nodes[0].properties.type = type
    const result = invalid(source, codes.invalidType, 'value')
    assert.equal(result.ast.modules[0].body[0].sourceId, 'value')
  }
})

test('aucune conversion implicite, même entre types numériques de tailles différentes', () => {
  const names = ['short int', 'short uint', 'int', 'uint', 'float', 'double']
  for (const from of names) {
    for (const to of names.filter((name) => name !== from)) {
      const source = literalProgram(from, 1)
      source.nodes[0].properties.type = primitiveType(to)
      invalid(source, codes.typeMismatch, 'value')
    }
  }
})

test('float/double : maxima, subnormaux, zéros signés et valeurs non finies', () => {
  for (const name of ['float', 'double']) {
    const definition = primitiveDefinitions[name]
    for (const value of [definition.max, -definition.max, definition.minPositive, -definition.minPositive, 0, '-0', '0.0e-9999']) valid(literalProgram(name, value))
    for (const value of [Infinity, -Infinity, NaN, '1e9999']) invalid(literalProgram(name, value), codes.overflow, 'literal')
    invalid(literalProgram(name, '1e-9999'), codes.underflow, 'literal')
    for (const value of ['', ' 1', '0x10', 'NaN', true]) invalid(literalProgram(name, value), codes.invalidLiteral, 'literal')
  }
  invalid(literalProgram('float', 3.5e38), codes.overflow, 'literal')
  invalid(literalProgram('float', 1e-46), codes.underflow, 'literal')
  valid(literalProgram('float', '0.1'))
})

test('string, char Unicode scalaire et boolean sont des types strictement distincts', () => {
  for (const value of ['', 'hello', '😀', 'several characters']) valid(literalProgram('string', value))
  for (const value of ['A', 'é', '😀']) valid(literalProgram('char', value))
  for (const value of ['', 'ab', 'e\u0301', '\ud800', 65]) invalid(literalProgram('char', value), codes.invalidLiteral, 'literal')
  for (const value of [true, false]) valid(literalProgram('boolean', value))
  for (const value of [0, 1, 'true', 'false']) invalid(literalProgram('boolean', value), codes.invalidLiteral, 'literal')
  const source = literalProgram('char', 'A')
  source.nodes[0].properties.type = primitiveType('string')
  invalid(source, codes.typeMismatch, 'value')
})

test('void réservé au retour : déclarations, paramètres, littéraux et conversions interdits', () => {
  for (const kind of ['VariableDeclaration', 'ConstantDeclaration', 'TypeDeclaration']) {
    const source = program('m')
    root(source, 'm', 'bad', kind, { name: 'bad', type: primitiveType('void') })
    invalid(source, codes.voidNotAllowed, 'bad')
  }
  invalid(functionProgram('void', ['void']), codes.voidNotAllowed, 'p0')
  invalid(literalProgram('void', null), codes.voidNotAllowed, 'literal')
  invalid(castProgram('int', 'void', 1), codes.voidNotAllowed, 'cast')
  valid(functionProgram('void'))
  const emptyReturn = functionProgram('void')
  addReturn(emptyReturn)
  valid(emptyReturn)
})

test('opérateurs : types identiques, aucun booléen numérique, aucune promotion des short', () => {
  valid(binaryProgram('short int', '+', 2, 3))
  valid(binaryProgram('int', '/', -7, 2))
  valid(binaryProgram('int', '%', -7, 2))
  valid(binaryProgram('double', '/', 7, 2))
  valid(binaryProgram('int', '<', 2, 3, 'boolean'))
  valid(binaryProgram('boolean', 'and', true, false, 'boolean'))
  valid(binaryProgram('char', '==', 'A', 'B', 'boolean'))
  valid(binaryProgram('string', '!=', 'a', 'b', 'boolean'))
  for (const source of [
    binaryProgram('short int', '+', 1, 2, 'short int', 'int'),
    binaryProgram('boolean', '+', true, false), binaryProgram('int', 'and', 1, 0),
    binaryProgram('float', '%', 2, 1), binaryProgram('string', '+', 'a', 'b'),
    binaryProgram('int', '==', 1, 1, 'boolean', 'uint'),
  ]) {
    const result = invalid(source, codes.typeMismatch, 'operation')
    assert.equal(result.semantic.nodeTypes.some((entry) => entry.nodeId === 'operation'), false)
  }
})

test('dépassements statiques entiers, unsigned et division signée minimale', () => {
  for (const source of [binaryProgram('short int', '+', 32767, 1), binaryProgram('short int', '*', 300, 300), binaryProgram('int', '/', -2147483648, -1), binaryProgram('uint', '-', 0, 1), binaryProgram('uint', '+', 4294967295, 1)]) {
    invalid(source, codes.overflow, 'operation')
  }
  for (const name of ['int', 'uint', 'float', 'double']) invalid(binaryProgram(name, '/', 1, 0), codes.divisionByZero, 'operation')
  invalid(binaryProgram('int', '%', 1, 0), codes.divisionByZero, 'operation')
})

test('opérations unaires : domaine signé, bornes et négation booléenne', () => {
  const source = literalProgram('short int', -32768)
  source.nodes[0].children.initializer = 'negation'
  node(source, 'm', 'negation', 'UnaryExpression', { operator: '-' }, { operand: 'literal' })
  invalid(source, codes.overflow, 'negation')
  source.nodes[0].properties.type = primitiveType('uint')
  source.nodes[1].properties = { type: primitiveType('uint'), value: 0 }
  invalid(source, codes.typeMismatch, 'negation')
  source.nodes[0].properties.type = primitiveType('boolean')
  source.nodes[1].properties = { type: primitiveType('boolean'), value: false }
  source.nodes[2].properties.operator = 'not'
  valid(source)
})

test('dépassements et sous-flux flottants dans les expressions constantes', () => {
  for (const name of ['float', 'double']) {
    invalid(binaryProgram(name, '*', primitiveDefinitions[name].max, 2), codes.overflow, 'operation')
    invalid(binaryProgram(name, '*', primitiveDefinitions[name].minPositive, 0.5), codes.underflow, 'operation')
    valid(binaryProgram(name, '-', primitiveDefinitions[name].minPositive, primitiveDefinitions[name].minPositive))
  }
})

test('conversions explicites : troncature, arrondi et contrôles des bornes', () => {
  valid(castProgram('double', 'int', 12.9))
  valid(castProgram('double', 'int', -12.9))
  valid(castProgram('int', 'float', 16777217))
  valid(castProgram('float', 'double', 0.1))
  valid(castProgram('double', 'short uint', 65535.9))
  valid(castProgram('char', 'char', 'A'))
  for (const [from, to, value] of [['int', 'short int', 32768], ['int', 'uint', -1], ['uint', 'int', 4294967295], ['double', 'int', 2147483648], ['double', 'float', 1e39]]) {
    invalid(castProgram(from, to, value), codes.overflow, 'cast')
  }
  invalid(castProgram('double', 'float', 1e-100), codes.underflow, 'cast')
  for (const [from, to, value] of [['string', 'int', '42'], ['int', 'boolean', 1], ['char', 'string', 'A']]) invalid(castProgram(from, to, value), codes.typeMismatch, 'cast')
})

test('binaire32 : arrondi décimal direct, liens à mi-distance et seuil de débordement exact', () => {
  const source = binaryProgram('float', '-', '1.000000059604644775390625000001', 1)
  source.nodes[0].children.initializer = 'division'
  node(source, 'm', 'division', 'BinaryExpression', { operator: '/' }, { left: 'numerator', right: 'operation' })
  node(source, 'm', 'numerator', 'Literal', { value: 1, type: primitiveType('float') })
  valid(source)
  source.nodes.find((entry) => entry.id === 'left').properties.value = '1.000000059604644775390625'
  invalid(source, codes.divisionByZero, 'division')
  source.nodes.find((entry) => entry.id === 'left').properties.value = '1.000000178813934326171875'
  source.nodes.find((entry) => entry.id === 'right').properties.value = '1.0000002384185791015625'
  invalid(source, codes.divisionByZero, 'division')
  const threshold = ((2n ** 24n - 1n) << 104n) + (1n << 103n)
  valid(literalProgram('float', (threshold - 1n).toString()))
  invalid(literalProgram('float', threshold.toString()), codes.overflow, 'literal')
  valid(literalProgram('float', '7.006492321624085354618647916449581e-46'))
  invalid(literalProgram('float', 2 ** -150), codes.underflow, 'literal')
})

test('la vérification constante respecte troncature entière et arrondi de chaque opération float', () => {
  for (const [operator, right, offset] of [['/', 2, 3], ['%', 2, 1]]) {
    const source = binaryProgram('int', operator, -7, right)
    source.nodes[0].children.initializer = 'division'
    node(source, 'm', 'sum', 'BinaryExpression', { operator: '+' }, { left: 'operation', right: 'offset' })
    node(source, 'm', 'offset', 'Literal', { type: primitiveType('int'), value: offset })
    node(source, 'm', 'division', 'BinaryExpression', { operator: '/' }, { left: 'numerator', right: 'sum' })
    node(source, 'm', 'numerator', 'Literal', { type: primitiveType('int'), value: 1 })
    invalid(source, codes.divisionByZero, 'division')
  }
  for (const name of ['float', 'double']) {
    const source = binaryProgram(name, '+', 16777216, 1)
    source.nodes[0].children.initializer = 'division'
    node(source, 'm', 'difference', 'BinaryExpression', { operator: '-' }, { left: 'operation', right: 'base' })
    node(source, 'm', 'base', 'Literal', { type: primitiveType(name), value: 16777216 })
    node(source, 'm', 'division', 'BinaryExpression', { operator: '/' }, { left: 'numerator', right: 'difference' })
    node(source, 'm', 'numerator', 'Literal', { type: primitiveType(name), value: 1 })
    if (name === 'float') invalid(source, codes.divisionByZero, 'division')
    else valid(source)
  }
})

test('affectations, conditions et retours sans conversion implicite', () => {
  const source = literalProgram('int', 1)
  source.nodes[0].kind = 'VariableDeclaration'
  root(source, 'm', 'assign', 'AssignmentStatement', {}, { target: 'target', value: 'different' })
  node(source, 'm', 'target', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  node(source, 'm', 'different', 'Literal', { value: 1, type: primitiveType('short int') })
  invalid(source, codes.typeMismatch, 'assign')
  for (const kind of ['IfStatement', 'WhileStatement', 'ForStatement']) {
    const condition = program('m')
    root(condition, 'm', 'control', kind, {}, { test: 'test', ...(kind === 'IfStatement' ? { consequent: 'body' } : { body: 'body' }) })
    node(condition, 'm', 'test', 'Literal', { value: 1, type: primitiveType('int') })
    node(condition, 'm', 'body', 'Block', {}, { statements: [] })
    invalid(condition, codes.typeMismatch, 'control')
  }
  const returned = functionProgram('int')
  addReturn(returned, 'short int', 1)
  invalid(returned, codes.typeMismatch, 'return')
})

test('appels : chaque paramètre, argument et arité est vérifié statiquement', () => {
  const source = functionProgram('int', ['int'])
  addReturn(source, 'int', 1)
  root(source, 'm', 'result', 'VariableDeclaration', { name: 'result', type: primitiveType('int') }, { initializer: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'fref', arguments: ['arg'] })
  node(source, 'm', 'fref', 'Reference', {}, {}, { target: { kind: 'name', name: 'f' } })
  node(source, 'm', 'arg', 'Literal', { type: primitiveType('int'), value: 1 })
  valid(source)
  source.nodes.find((entry) => entry.id === 'arg').properties.type = primitiveType('uint')
  const bad = invalid(source, codes.typeMismatch, 'call')
  assert.ok(bad.semantic.untypedNodeIds.includes('call'))
  source.nodes.find((entry) => entry.id === 'call').children.arguments = []
  invalid(source, codes.typeMismatch, 'call')
})

test('retours requis : fonction non vide sur tous les chemins, void sans expression', () => {
  invalid(functionProgram('int'), codes.missingReturn, 'f')
  const noValue = functionProgram('int')
  addReturn(noValue)
  invalid(noValue, codes.typeMismatch, 'return')
  const voidValue = functionProgram('void')
  addReturn(voidValue, 'int', 1)
  invalid(voidValue, codes.voidNotAllowed, 'return')
  const branched = functionProgram('int')
  branched.nodes.find((entry) => entry.id === 'body').children.statements = ['if']
  node(branched, 'm', 'if', 'IfStatement', {}, { test: 'test', consequent: 'then', alternate: 'else' })
  node(branched, 'm', 'test', 'Literal', { type: primitiveType('boolean'), value: true })
  for (const side of ['then', 'else']) {
    node(branched, 'm', side, 'Block', {}, { statements: [`return${side}`] })
    node(branched, 'm', `return${side}`, 'ReturnStatement', {}, { argument: `value${side}` })
    node(branched, 'm', `value${side}`, 'Literal', { type: primitiveType('int'), value: 1 })
  }
  valid(branched)
  branched.nodes.find((entry) => entry.id === 'if').children.alternate = null
  invalid(branched, codes.missingReturn, 'f')
})

test('programme incomplet : source conservée et aucune expression typée arbitrairement', () => {
  const source = binaryProgram('int', '+', 1, 2)
  source.nodes.find((entry) => entry.id === 'operation').children.left = null
  const snapshot = JSON.stringify(source)
  const result = invalid(source, codes.untypedExpression, 'operation')
  assert.ok(result.ast.modules[0].body[0].children.initializer.children.left.kind === 'Hole')
  assert.equal(result.semantic.nodeTypes.some((entry) => entry.nodeId === 'operation'), false)
  assert.equal(JSON.stringify(source), snapshot)
})

test('les annotations ne peuvent pas forcer le type des opérateurs ou des références', () => {
  const source = binaryProgram('int', '+', 1, 2)
  source.nodes.find((entry) => entry.id === 'operation').properties.type = primitiveType('double')
  invalid(source, codes.invalidStructure, 'operation')
})

test('les signatures récursives sont statiques, sans exécuter les appels', () => {
  const source = functionProgram('int', ['int'])
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['return']
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'recursiveCall' })
  node(source, 'm', 'recursiveCall', 'CallExpression', {}, { callee: 'self', arguments: ['argument'] })
  node(source, 'm', 'self', 'Reference', {}, {}, { target: { kind: 'name', name: 'f' } })
  node(source, 'm', 'argument', 'Reference', {}, {}, { target: { kind: 'name', name: 'p0' } })
  valid(source)
})

test('les appels void sont permis comme instructions, jamais comme valeurs de variable', () => {
  const source = functionProgram('void')
  root(source, 'm', 'statement', 'ExpressionStatement', {}, { expression: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'fref', arguments: [] })
  node(source, 'm', 'fref', 'Reference', {}, {}, { target: { kind: 'name', name: 'f' } })
  valid(source)
  source.nodes.find((entry) => entry.id === 'statement').kind = 'VariableDeclaration'
  source.nodes.find((entry) => entry.id === 'statement').properties = { name: 'result', type: primitiveType('int') }
  source.nodes.find((entry) => entry.id === 'statement').children = { initializer: 'call' }
  invalid(source, codes.typeMismatch, 'statement')
})

test('les références constantes propagent leurs bornes et les cycles restent diagnostiqués', () => {
  const source = literalProgram('short int', 32767)
  root(source, 'm', 'result', 'VariableDeclaration', { name: 'result', type: primitiveType('short int') }, { initializer: 'add' })
  node(source, 'm', 'add', 'BinaryExpression', { operator: '+' }, { left: 'reference', right: 'one' })
  node(source, 'm', 'reference', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  node(source, 'm', 'one', 'Literal', { value: 1, type: primitiveType('short int') })
  invalid(source, codes.overflow, 'add')
  const cyclic = program('m')
  root(cyclic, 'm', 'a', 'ConstantDeclaration', { name: 'a', type: primitiveType('int') }, { initializer: 'bref' })
  root(cyclic, 'm', 'b', 'ConstantDeclaration', { name: 'b', type: primitiveType('int') }, { initializer: 'aref' })
  node(cyclic, 'm', 'bref', 'Reference', {}, {}, { target: { kind: 'name', name: 'b' } })
  node(cyclic, 'm', 'aref', 'Reference', {}, {}, { target: { kind: 'name', name: 'a' } })
  assert.equal(analyzeProgram(cyclic).diagnostics.some((diagnostic) => diagnostic.code === codes.constantCycle), true)
})

test('une division par zéro constant est refusée même avec un numérateur paramètre', () => {
  const source = functionProgram('int', ['int'])
  source.nodes.find((entry) => entry.id === 'body').children.statements = ['return']
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: 'division' })
  node(source, 'm', 'division', 'BinaryExpression', { operator: '/' }, { left: 'parameter', right: 'zero' })
  node(source, 'm', 'parameter', 'Reference', {}, {}, { target: { kind: 'name', name: 'p0' } })
  node(source, 'm', 'zero', 'Literal', { type: primitiveType('int'), value: 0 })
  invalid(source, codes.divisionByZero, 'division')
})

test('les appels intermodules conservent la signature stricte et refusent un autre signe', () => {
  const source = functionProgram('int', ['int'])
  addReturn(source, 'int', 42)
  source.modules[0].exports.push({ nodeId: 'f', name: 'compute' })
  source.modules.push(engine.createModule('app', 'app'))
  source.modules[1].imports.push({ id: 'importF', moduleId: 'm', nodeId: 'f', localName: 'compute' })
  root(source, 'app', 'result', 'VariableDeclaration', { name: 'result', type: primitiveType('int') }, { initializer: 'call' })
  node(source, 'app', 'call', 'CallExpression', {}, { callee: 'imported', arguments: ['argument'] })
  node(source, 'app', 'imported', 'Reference', {}, {}, { target: { kind: 'import', importId: 'importF' } })
  node(source, 'app', 'argument', 'Literal', { type: primitiveType('int'), value: 1 })
  valid(source)
  source.nodes.find((entry) => entry.id === 'argument').properties.type = primitiveType('uint')
  invalid(source, codes.typeMismatch, 'call')
})

test('sérialisation : types stricts et zéro négatif textuel conservés, -0 numérique non perdu silencieusement', () => {
  const source = castProgram('double', 'float', '-0')
  const saved = engine.serializeSource(source)
  const reconstructed = engine.deserializeSource(saved.json).source
  assert.deepEqual(reconstructed, source)
  assert.deepEqual(analyzeProgram(reconstructed), analyzeProgram(source))
  assert.equal(engine.serializeSource(literalProgram('double', -0)).json, null)
})
