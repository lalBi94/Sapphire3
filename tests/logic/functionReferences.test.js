import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeProgram, simulateProgram, functionType, isFunctionType, sameType,
  primitiveType, arrayType, typeFromRecord,
} from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { initialNodeForm, typeFromName, typeNameFromType } from '../../src/components/NodeForm/nodeConfiguration.js'
import { typeLabel } from '../../src/components/LogicTree/logicLabels.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const stringType = { kind: 'primitive', name: 'string' }
const intList = { kind: 'array', elementType: intType }
const intVoid = { kind: 'function', parameters: [intType], returnType: voidType }
const stringVoid = { kind: 'function', parameters: [stringType], returnType: voidType }

const literal = (source, id, type, value) => node(source, 'm', id, 'Literal', { type, value })
const reference = (source, id, target) => node(source, 'm', id, 'Reference', {}, {}, { target: { kind: 'node', nodeId: target } })

// Ajoute une fonction void qui imprime son unique paramètre entier.
function visitFunction(source, name, id = 'visit') {
  root(source, 'm', id, 'FunctionDeclaration', { name, type: voidType }, { parameters: [`${id}Param`], body: `${id}Body` })
  node(source, 'm', `${id}Param`, 'Parameter', { name: 'value', type: intType })
  node(source, 'm', `${id}Body`, 'Block', {}, { statements: [`${id}Print`] })
  node(source, 'm', `${id}Print`, 'PrintStatement', {}, { value: `${id}Value` })
  reference(source, `${id}Value`, `${id}Param`)
}

// Variable de type fonction initialisée par une référence, puis appelée via cette variable.
function callbackProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['declare', 'invoke', 'return'] })
  node(source, 'm', 'declare', 'VariableDeclaration', { name: 'callback', type: intVoid }, { initializer: 'callbackRef' })
  reference(source, 'callbackRef', 'visit')
  node(source, 'm', 'invoke', 'ExpressionStatement', {}, { expression: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'callbackUse', arguments: ['five'] })
  reference(source, 'callbackUse', 'declare')
  literal(source, 'five', intType, 5)
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: null })
  visitFunction(source, 'visit')
  return source
}

// Tableau global parcouru par ForEach ; le rappel modifie une autre case du tableau.
function forEachProgram() {
  const source = program('m')
  root(source, 'm', 'items', 'VariableDeclaration', { name: 'items', type: intList }, { initializer: 'list' })
  node(source, 'm', 'list', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  literal(source, 'one', intType, 1)
  literal(source, 'two', intType, 2)
  literal(source, 'three', intType, 3)
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['each', 'return'] })
  node(source, 'm', 'each', 'ForEachStatement', {}, { array: 'itemsRef', callback: 'visitRef' })
  reference(source, 'itemsRef', 'items')
  reference(source, 'visitRef', 'visit')
  node(source, 'm', 'return', 'ReturnStatement', {}, { argument: null })
  visitFunction(source, 'visit')
  return source
}

// Rappel qui écrase volontairement la deuxième case du tableau pendant le parcours.
function snapshotProgram() {
  const source = forEachProgram()
  const visitBody = source.nodes.find((entry) => entry.id === 'visitBody')
  visitBody.children.statements = ['overwrite', 'visitPrint', 'visitReturn']
  node(source, 'm', 'overwrite', 'AssignmentStatement', {}, { target: 'second', value: 'nine' })
  node(source, 'm', 'second', 'ArrayAccess', {}, { array: 'itemsTarget', index: 'oneIndex' })
  reference(source, 'itemsTarget', 'items')
  literal(source, 'oneIndex', intType, 1)
  literal(source, 'nine', intType, 9)
  node(source, 'm', 'visitReturn', 'ReturnStatement', {}, { argument: null })
  return source
}

test('type fonction : signature structurelle, annotation et sérialisation du sélecteur', () => {
  assert.equal(isFunctionType(intVoid), true)
  assert.equal(sameType(intVoid, functionType([intType], voidType)), true)
  assert.equal(sameType(intVoid, stringVoid), false)
  assert.deepEqual(typeFromRecord(intVoid), intVoid)
  assert.equal(typeFromRecord({ kind: 'function', parameters: [voidType], returnType: voidType }), null)
  assert.equal(typeFromRecord({ kind: 'function', parameters: [intType], returnType: intList }), null)

  const name = typeNameFromType(intVoid)
  assert.deepEqual(typeFromName(name), intVoid)
  assert.equal(typeLabel(intVoid, (key) => key), '(int) → void')
  const form = initialNodeForm('VariableDeclaration', { properties: { name: 'callback', type: intVoid } }, null, [])
  assert.equal(form.typeName, name)
})

test('référence de fonction : variable annotée, appel via la variable et affichage simulé', () => {
  const source = callbackProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(analysis.semantic.symbols.find((symbol) => symbol.name === 'callback').type, intVoid)
  assert.deepEqual(analysis.semantic.nodeTypes.find((entry) => entry.nodeId === 'call').type, voidType)

  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.error)
  assert.deepEqual(simulation.output, ['5'])
  const callback = simulation.variables.find((entry) => entry.name === 'callback')
  assert.equal(callback.value, 'fn visit')
})

test('référence de fonction : une signature différente est refusée statiquement', () => {
  const source = callbackProgram()
  source.nodes.find((entry) => entry.id === 'declare').properties.type = stringVoid
  const analysis = analyzeProgram(source)
  assert.equal(analysis.canGenerate, false)
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH'))
})

test('type fonction : interdit hors variable, constante et paramètre', () => {
  const source = callbackProgram()
  source.nodes.find((entry) => entry.id === 'five').properties.type = intVoid
  const analysis = analyzeProgram(source)
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'TYPE_INVALID'))
})

test('ForEach : parcourt le tableau, appelle le rappel et copie les éléments visités', () => {
  const source = forEachProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.error)
  assert.deepEqual(simulation.output, ['1', '2', '3'])

  const snapshot = simulateProgram(snapshotProgram())
  assert.equal(snapshot.ok, true, snapshot.error)
  assert.deepEqual(snapshot.output, ['1', '2', '3'])
  const items = snapshot.variables.find((entry) => entry.name === 'items')
  assert.equal(items.value, '[1, 9, 3]')
})

test('ForEach : refuse un tableau non tableau et un rappel de mauvaise signature', () => {
  const notArray = forEachProgram()
  notArray.nodes.find((entry) => entry.id === 'items').properties.type = intType
  assert.ok(analyzeProgram(notArray).diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH'))

  const wrongParameter = forEachProgram()
  wrongParameter.nodes.find((entry) => entry.id === 'visitParam').properties.type = stringType
  assert.ok(analyzeProgram(wrongParameter).diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH'))

  const wrongReturn = forEachProgram()
  wrongReturn.nodes.find((entry) => entry.id === 'visit').properties.type = intType
  const body = wrongReturn.nodes.find((entry) => entry.id === 'visitBody')
  body.children.statements.push('visitReturn')
  node(wrongReturn, 'm', 'visitReturn', 'ReturnStatement', {}, { argument: 'visitLiteral' })
  literal(wrongReturn, 'visitLiteral', intType, 0)
  assert.ok(analyzeProgram(wrongReturn).diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH'))
})

test('ForEach : la transpilation JavaScript copie le tableau et appelle le rappel', () => {
  const source = forEachProgram()
  const generated = transpileProgram(source)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /function sapphireForEach\(array, callback\)/)
  assert.match(generated.code, /for \(const element of \[\.\.\.array\]\) callback\(element\);/)
  assert.match(generated.code, /sapphireForEach\(sapphireRead\(m_items\), sapphireRead\(m_visit\)\);/)
})

test('ForEach : la transpilation Python copie la liste et appelle le rappel', () => {
  const source = forEachProgram()
  const generated = transpileProgram(source, { target: 'python' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /def sapphireForEach\(array, callback\):/)
  assert.match(generated.code, /for element in list\(array\):/)
  assert.match(generated.code, /sapphireForEach\(sapphireRead\(m_items\), sapphireRead\(m_visit\)\)/)
})

test('ForEach : JavaScript et Python générés reproduisent la sortie du simulateur, copie comprise', () => {
  const source = snapshotProgram()
  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.error)
  const expected = simulation.output.map((line) => `${line}\n`).join('')

  const javascript = transpileProgram(source)
  assert.equal(javascript.ok, true, JSON.stringify(javascript.diagnostics))
  const jsOutput = execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  assert.equal(jsOutput, expected)

  const python = transpileProgram(source, { target: 'python' })
  assert.equal(python.ok, true, JSON.stringify(python.diagnostics))
  const pyOutput = execFileSync('python', ['-c', python.code], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  assert.equal(pyOutput, expected)
})
