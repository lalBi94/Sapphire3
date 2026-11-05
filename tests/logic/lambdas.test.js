import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeProgram, simulateProgram, functionType } from '../../src/utils/logic/index.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { initialNodeForm, nodeConfiguration } from '../../src/components/NodeForm/nodeConfiguration.js'
import { program, root, node, intType, booleanType } from './fixtures.js'

const fnIntInt = functionType([intType], intType)
const voidType = { kind: 'primitive', name: 'void' }

// Programme : une variable globale typée fonction contient une lambda qui capture une autre globale.
function capturedProgram() {
  const source = program('m')
  root(source, 'm', 'offset', 'VariableDeclaration', { name: 'offset', type: intType }, { initializer: 'ten' })
  node(source, 'm', 'ten', 'Literal', { type: intType, value: 10 })
  root(source, 'm', 'adder', 'VariableDeclaration', { name: 'adder', type: fnIntInt }, { initializer: 'adderLambda' })
  node(source, 'm', 'adderLambda', 'LambdaExpression', { type: intType }, { parameters: ['adderX'], body: 'adderSum' })
  node(source, 'm', 'adderX', 'Parameter', { name: 'x', type: intType })
  node(source, 'm', 'adderSum', 'BinaryExpression', { operator: '+' }, { left: 'adderXRef', right: 'offsetRef' })
  node(source, 'm', 'adderXRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'adderX' } })
  node(source, 'm', 'offsetRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'offset' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['printSum'] })
  node(source, 'm', 'printSum', 'PrintStatement', {}, { value: 'adderCall' })
  node(source, 'm', 'adderCall', 'CallExpression', {}, { callee: 'adderRef', arguments: ['five'] })
  node(source, 'm', 'adderRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'adder' } })
  node(source, 'm', 'five', 'Literal', { type: intType, value: 5 })
  return source
}

// Programme : une fonction retourne une lambda qui capture son paramètre local.
function closureFactoryProgram() {
  const source = program('m')
  root(source, 'm', 'makeAdder', 'FunctionDeclaration', { name: 'makeAdder', type: fnIntInt }, { parameters: ['base'], body: 'makeBody' })
  node(source, 'm', 'base', 'Parameter', { name: 'base', type: intType })
  node(source, 'm', 'makeBody', 'Block', {}, { statements: ['makeReturn'] })
  node(source, 'm', 'makeReturn', 'ReturnStatement', {}, { argument: 'madeLambda' })
  node(source, 'm', 'madeLambda', 'LambdaExpression', { type: intType }, { parameters: ['madeX'], body: 'madeSum' })
  node(source, 'm', 'madeX', 'Parameter', { name: 'x', type: intType })
  node(source, 'm', 'madeSum', 'BinaryExpression', { operator: '+' }, { left: 'madeXRef', right: 'baseRef' })
  node(source, 'm', 'madeXRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'madeX' } })
  node(source, 'm', 'baseRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'base' } })
  root(source, 'm', 'addFive', 'VariableDeclaration', { name: 'addFive', type: fnIntInt }, { initializer: 'makeCall' })
  node(source, 'm', 'makeCall', 'CallExpression', {}, { callee: 'makeAdderRef', arguments: ['five'] })
  node(source, 'm', 'makeAdderRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'makeAdder' } })
  node(source, 'm', 'five', 'Literal', { type: intType, value: 5 })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['printResult'] })
  node(source, 'm', 'printResult', 'PrintStatement', {}, { value: 'resultCall' })
  node(source, 'm', 'resultCall', 'CallExpression', {}, { callee: 'addFiveRef', arguments: ['three'] })
  node(source, 'm', 'addFiveRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'addFive' } })
  node(source, 'm', 'three', 'Literal', { type: intType, value: 3 })
  return source
}

// Programme : une lambda void est passée directement à ForEach et appelle une fonction d'affichage.
function forEachLambdaProgram() {
  const source = program('m')
  root(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: { kind: 'array', elementType: intType } }, { initializer: 'valueArray' })
  node(source, 'm', 'valueArray', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two'] })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  root(source, 'm', 'show', 'FunctionDeclaration', { name: 'show', type: voidType }, { parameters: ['shown'], body: 'showBody' })
  node(source, 'm', 'shown', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'showBody', 'Block', {}, { statements: ['showPrint'] })
  node(source, 'm', 'showPrint', 'PrintStatement', {}, { value: 'shownRef' })
  node(source, 'm', 'shownRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'shown' } })
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['each'] })
  node(source, 'm', 'each', 'ForEachStatement', {}, { array: 'valuesRef', callback: 'printer' })
  node(source, 'm', 'valuesRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'printer', 'LambdaExpression', { type: voidType }, { parameters: ['printerValue'], body: 'showCall' })
  node(source, 'm', 'printerValue', 'Parameter', { name: 'element', type: intType })
  node(source, 'm', 'showCall', 'CallExpression', {}, { callee: 'showRef', arguments: ['printerValueRef'] })
  node(source, 'm', 'showRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'show' } })
  node(source, 'm', 'printerValueRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'printerValue' } })
  return source
}

// Programme : une lambda est appelée immédiatement sur un argument littéral.
function immediateLambdaProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['printResult'] })
  node(source, 'm', 'printResult', 'PrintStatement', {}, { value: 'immediateCall' })
  node(source, 'm', 'immediateCall', 'CallExpression', {}, { callee: 'increment', arguments: ['four'] })
  node(source, 'm', 'increment', 'LambdaExpression', { type: intType }, { parameters: ['incrementValue'], body: 'plusOne' })
  node(source, 'm', 'incrementValue', 'Parameter', { name: 'value', type: intType })
  node(source, 'm', 'plusOne', 'BinaryExpression', { operator: '+' }, { left: 'incrementRef', right: 'one' })
  node(source, 'm', 'incrementRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'incrementValue' } })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'four', 'Literal', { type: intType, value: 4 })
  return source
}

// Retourne le type résolu d'un nœud, ou null.
function typeOf(analysis, nodeId) {
  return analysis.semantic.nodeTypes.find((entry) => entry.nodeId === nodeId)?.type ?? null
}

// Exécute le code transpilé et renvoie ses lignes.
function execute(target, code) {
  const output = target === 'python'
    ? execFileSync('python', ['-c', code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    : execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 3000 })
  return output.trim().split(/\r?\n/)
}

test('lambda : capture d’une globale, type fonction et appel via une variable', () => {
  const source = capturedProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'adderLambda'), fnIntInt)
  assert.deepEqual(typeOf(analysis, 'adderCall'), intType)
  assert.deepEqual(simulateProgram(source).output, ['15'])
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(source, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), ['15'], target)
  }
})

test('fermeture : une lambda capture un paramètre local et survit au retour de sa fonction', () => {
  const source = closureFactoryProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'madeLambda'), fnIntInt)
  assert.deepEqual(typeOf(analysis, 'makeCall'), fnIntInt)
  assert.deepEqual(simulateProgram(source).output, ['8'])
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(source, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), ['8'], target)
  }
})

test('lambda : rappel void direct dans ForEach', () => {
  const source = forEachLambdaProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'printer'), functionType([intType], voidType))
  assert.deepEqual(simulateProgram(source).output, ['1', '2'])
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(source, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), ['1', '2'], target)
  }
})

test('lambda : invocation immédiate', () => {
  const source = immediateLambdaProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'immediateCall'), intType)
  assert.deepEqual(simulateProgram(source).output, ['5'])
  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(source, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), ['5'], target)
  }
})

test('lambda : corps incompatible, pointeur interdit sur un paramètre et type générique refusé', () => {
  const bodyMismatch = capturedProgram()
  bodyMismatch.nodes.find((entry) => entry.id === 'adderSum').properties = { type: booleanType, value: true }
  bodyMismatch.nodes.find((entry) => entry.id === 'adderSum').kind = 'Literal'
  bodyMismatch.nodes.find((entry) => entry.id === 'adderSum').children = {}
  assert.ok(analyzeProgram(bodyMismatch).diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'adderLambda'))

  const address = capturedProgram()
  address.nodes.find((entry) => entry.id === 'adderSum').kind = 'UnaryExpression'
  address.nodes.find((entry) => entry.id === 'adderSum').properties = { operator: '&' }
  address.nodes.find((entry) => entry.id === 'adderSum').children = { operand: 'adderXRef' }
  assert.ok(analyzeProgram(address).diagnostics.some((entry) => entry.code === 'PLACEMENT_ILLEGAL' && entry.location.nodeId === 'adderSum'))

  const genericParameter = capturedProgram()
  genericParameter.nodes.find((entry) => entry.id === 'adderX').properties.type = { kind: 'generic', name: 'T' }
  assert.ok(analyzeProgram(genericParameter).diagnostics.some((entry) => entry.code === 'TYPE_INVALID' && entry.location.nodeId === 'adderX'))

  const variableMismatch = capturedProgram()
  variableMismatch.nodes.find((entry) => entry.id === 'adder').properties.type = intType
  assert.ok(analyzeProgram(variableMismatch).diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'adder'))
})

test('lambda : formulaires, signature construite et préremplissage depuis le slot', () => {
  const form = initialNodeForm('LambdaExpression', null, fnIntInt, [])
  assert.equal(form.typeName, 'int')
  assert.deepEqual(form.parameters, [{ name: '', typeName: 'int' }])
  form.parameters[0].name = 'x'
  form.expression = { mode: 'literal', value: '5', empty: false }
  const draft = nodeConfiguration('LambdaExpression', form, [])
  assert.equal(draft.kind, 'LambdaExpression')
  assert.deepEqual(draft.properties.type, intType)
  assert.equal(draft.children.parameters[0].properties.name, 'x')
  assert.equal(draft.children.parameters[0].properties.type.name, 'int')
  assert.equal(draft.children.body.properties.value, '5')

  const variable = initialNodeForm('VariableDeclaration', null, null, [])
  variable.name = 'callback'
  variable.typeName = '@function:new'
  variable.functionTypeBuilder = { parameters: [{ typeName: 'int' }], returnTypeName: 'void' }
  const configured = nodeConfiguration('VariableDeclaration', variable, [])
  assert.deepEqual(configured.properties.type, functionType([intType], voidType))
})

test('lambda : le workspace conserve la lambda et le retour de type fonction', () => {
  const source = closureFactoryProgram()
  const cards = source.modules.map((module) => ({ id: module.id, type: 'module', name: module.name, x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }))
  const text = serializeWorkspace(source, cards, { x: 0, y: 0, zoomLevel: 0 })
  const restored = deserializeWorkspace(text).project
  assert.equal(restored.nodes.find((entry) => entry.id === 'madeLambda').kind, 'LambdaExpression')
  assert.deepEqual(restored.nodes.find((entry) => entry.id === 'makeAdder').properties.type, fnIntInt)
  assert.deepEqual(analyzeProgram(restored).diagnostics.filter((entry) => entry.severity === 'error'), [])
})
