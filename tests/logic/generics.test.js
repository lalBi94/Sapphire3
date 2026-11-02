import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeProgram, simulateProgram, createContextIndex, createNodeBundle, insertSourceNodes } from '../../src/utils/logic/index.js'
import { serializeWorkspace, deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType, stringType, booleanType } from './fixtures.js'

const genericT = { kind: 'generic', name: 'T' }
const voidType = { kind: 'primitive', name: 'void' }

// Compose trois fonctions génériques et des appels directs avec plusieurs primitifs.
function genericProgram() {
  const source = program('m')
  root(source, 'm', 'identity', 'FunctionDeclaration', { name: 'identity', type: genericT, generic: true }, { parameters: ['identityValue'], body: 'identityBody' })
  node(source, 'm', 'identityValue', 'Parameter', { name: 'value', type: genericT })
  node(source, 'm', 'identityBody', 'Block', {}, { statements: ['identityReturn'] })
  node(source, 'm', 'identityReturn', 'ReturnStatement', {}, { argument: 'identityRef' })
  node(source, 'm', 'identityRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identityValue' } })

  root(source, 'm', 'first', 'FunctionDeclaration', { name: 'first', type: genericT, generic: true }, { parameters: ['firstA', 'firstB'], body: 'firstBody' })
  node(source, 'm', 'firstA', 'Parameter', { name: 'a', type: genericT })
  node(source, 'm', 'firstB', 'Parameter', { name: 'b', type: genericT })
  node(source, 'm', 'firstBody', 'Block', {}, { statements: ['firstReturn'] })
  node(source, 'm', 'firstReturn', 'ReturnStatement', {}, { argument: 'firstARef' })
  node(source, 'm', 'firstARef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'firstA' } })

  root(source, 'm', 'choose', 'FunctionDeclaration', { name: 'choose', type: genericT, generic: true }, { parameters: ['chooseCondition', 'chooseA', 'chooseB'], body: 'chooseBody' })
  node(source, 'm', 'chooseCondition', 'Parameter', { name: 'condition', type: booleanType })
  node(source, 'm', 'chooseA', 'Parameter', { name: 'a', type: genericT })
  node(source, 'm', 'chooseB', 'Parameter', { name: 'b', type: genericT })
  node(source, 'm', 'chooseBody', 'Block', {}, { statements: ['chooseIf'] })
  node(source, 'm', 'chooseIf', 'IfStatement', {}, { test: 'chooseConditionRef', consequent: 'chooseThen', alternate: 'chooseElse' })
  node(source, 'm', 'chooseConditionRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'chooseCondition' } })
  node(source, 'm', 'chooseThen', 'Block', {}, { statements: ['chooseReturnA'] })
  node(source, 'm', 'chooseReturnA', 'ReturnStatement', {}, { argument: 'chooseARef' })
  node(source, 'm', 'chooseARef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'chooseA' } })
  node(source, 'm', 'chooseElse', 'Block', {}, { statements: ['chooseReturnB'] })
  node(source, 'm', 'chooseReturnB', 'ReturnStatement', {}, { argument: 'chooseBRef' })
  node(source, 'm', 'chooseBRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'chooseB' } })

  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'm', 'mainBody', 'Block', {}, { statements: ['printInt', 'printString', 'printBool', 'printFirst', 'printFirstString', 'printChoose', 'printChooseString'] })
  node(source, 'm', 'printInt', 'PrintStatement', {}, { value: 'identityIntCall' })
  node(source, 'm', 'identityIntCall', 'CallExpression', {}, { callee: 'identityIntRef', arguments: ['int42'] })
  node(source, 'm', 'identityIntRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identity' } })
  node(source, 'm', 'int42', 'Literal', { type: intType, value: 42 })
  node(source, 'm', 'printString', 'PrintStatement', {}, { value: 'identityStringCall' })
  node(source, 'm', 'identityStringCall', 'CallExpression', {}, { callee: 'identityStringRef', arguments: ['hello'] })
  node(source, 'm', 'identityStringRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identity' } })
  node(source, 'm', 'hello', 'Literal', { type: stringType, value: 'hello' })
  node(source, 'm', 'printBool', 'PrintStatement', {}, { value: 'identityBoolCall' })
  node(source, 'm', 'identityBoolCall', 'CallExpression', {}, { callee: 'identityBoolRef', arguments: ['truth'] })
  node(source, 'm', 'identityBoolRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identity' } })
  node(source, 'm', 'truth', 'Literal', { type: booleanType, value: true })
  node(source, 'm', 'printFirst', 'PrintStatement', {}, { value: 'firstCall' })
  node(source, 'm', 'firstCall', 'CallExpression', {}, { callee: 'firstRef', arguments: ['one', 'two'] })
  node(source, 'm', 'firstRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'first' } })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'printFirstString', 'PrintStatement', {}, { value: 'firstStringCall' })
  node(source, 'm', 'firstStringCall', 'CallExpression', {}, { callee: 'firstStringRef', arguments: ['firstText', 'firstOther'] })
  node(source, 'm', 'firstStringRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'first' } })
  node(source, 'm', 'firstText', 'Literal', { type: stringType, value: 'a' })
  node(source, 'm', 'firstOther', 'Literal', { type: stringType, value: 'b' })
  node(source, 'm', 'printChoose', 'PrintStatement', {}, { value: 'chooseCall' })
  node(source, 'm', 'chooseCall', 'CallExpression', {}, { callee: 'chooseRef', arguments: ['yes', 'seven', 'eight'] })
  node(source, 'm', 'chooseRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'choose' } })
  node(source, 'm', 'yes', 'Literal', { type: booleanType, value: true })
  node(source, 'm', 'seven', 'Literal', { type: intType, value: 7 })
  node(source, 'm', 'eight', 'Literal', { type: intType, value: 8 })
  node(source, 'm', 'printChooseString', 'PrintStatement', {}, { value: 'chooseStringCall' })
  node(source, 'm', 'chooseStringCall', 'CallExpression', {}, { callee: 'chooseStringRef', arguments: ['no', 'chooseTextA', 'chooseTextB'] })
  node(source, 'm', 'chooseStringRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'choose' } })
  node(source, 'm', 'no', 'Literal', { type: booleanType, value: false })
  node(source, 'm', 'chooseTextA', 'Literal', { type: stringType, value: 'x' })
  node(source, 'm', 'chooseTextB', 'Literal', { type: stringType, value: 'y' })
  source.modules[0].exports.push({ nodeId: 'identity', name: 'identity' })
  return source
}

// Retourne le type résolu d'un nœud, ou null.
function typeOf(analysis, nodeId) {
  return analysis.semantic.nodeTypes.find((entry) => entry.nodeId === nodeId)?.type ?? null
}

test('généricité : identity, first et choose infèrent un primitif non void', () => {
  const source = genericProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'identityIntCall'), intType)
  assert.deepEqual(typeOf(analysis, 'identityStringCall'), stringType)
  assert.deepEqual(typeOf(analysis, 'identityBoolCall'), booleanType)
  assert.deepEqual(typeOf(analysis, 'firstCall'), intType)
  assert.deepEqual(typeOf(analysis, 'firstStringCall'), stringType)
  assert.deepEqual(typeOf(analysis, 'chooseCall'), intType)
  assert.deepEqual(typeOf(analysis, 'chooseStringCall'), stringType)
  const inferred = new Map(analysis.semantic.genericCalls.map((entry) => [entry.nodeId, entry.type]))
  assert.deepEqual(inferred.get('identityIntCall'), intType)
  assert.deepEqual(inferred.get('identityStringCall'), stringType)
  assert.deepEqual(inferred.get('identityBoolCall'), booleanType)
  assert.deepEqual(inferred.get('firstStringCall'), stringType)
  assert.deepEqual(inferred.get('chooseStringCall'), stringType)
  assert.deepEqual(simulateProgram(source).output, ['42', 'hello', 'true', '1', 'a', '7', 'y'])
})

test('généricité : appels incompatibles, ambigus et usage comme valeur refusés', () => {
  const mismatch = genericProgram()
  mismatch.nodes.find((entry) => entry.id === 'two').properties = { type: stringType, value: 'two' }
  const mismatchAnalysis = analyzeProgram(mismatch)
  assert.ok(mismatchAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'firstCall'))

  const value = genericProgram()
  node(value, 'm', 'identityValueUse', 'ExpressionStatement', {}, { expression: 'identityValueRef' })
  value.nodes.find((entry) => entry.id === 'mainBody').children.statements.push('identityValueUse')
  node(value, 'm', 'identityValueRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identity' } })
  const valueAnalysis = analyzeProgram(value)
  assert.ok(valueAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'identityValueRef'))

  const arithmetic = genericProgram()
  arithmetic.nodes.find((entry) => entry.id === 'identityReturn').children.argument = 'identityPlus'
  node(arithmetic, 'm', 'identityPlus', 'BinaryExpression', { operator: '+' }, { left: 'identityRef', right: 'identityOne' })
  node(arithmetic, 'm', 'identityOne', 'Literal', { type: intType, value: 1 })
  const arithmeticAnalysis = analyzeProgram(arithmetic)
  assert.ok(arithmeticAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_MISMATCH' && entry.location.nodeId === 'identityPlus'))

  const nested = genericProgram()
  nested.nodes.find((entry) => entry.id === 'identityValue').properties.type = { kind: 'array', elementType: genericT }
  const nestedAnalysis = analyzeProgram(nested)
  assert.ok(nestedAnalysis.diagnostics.some((entry) => entry.code === 'TYPE_INVALID' && entry.location.nodeId === 'identityValue'))
})

test('généricité : appel intermodule simulé et transpilé', () => {
  const source = program('lib', 'app')
  root(source, 'lib', 'identity', 'FunctionDeclaration', { name: 'identity', type: genericT, generic: true }, { parameters: ['identityValue'], body: 'identityBody' })
  node(source, 'lib', 'identityValue', 'Parameter', { name: 'value', type: genericT })
  node(source, 'lib', 'identityBody', 'Block', {}, { statements: ['identityReturn'] })
  node(source, 'lib', 'identityReturn', 'ReturnStatement', {}, { argument: 'identityRef' })
  node(source, 'lib', 'identityRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'identityValue' } })
  source.modules.find((module) => module.id === 'lib').exports.push({ nodeId: 'identity', name: 'identity' })
  source.modules.find((module) => module.id === 'app').imports.push({ id: 'identityImport', moduleId: 'lib', nodeId: 'identity', localName: 'identity' })
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'app', 'mainBody', 'Block', {}, { statements: ['print'] })
  node(source, 'app', 'print', 'PrintStatement', {}, { value: 'call' })
  node(source, 'app', 'call', 'CallExpression', {}, { callee: 'callee', arguments: ['value'] })
  node(source, 'app', 'callee', 'Reference', {}, {}, { target: { kind: 'import', importId: 'identityImport' } })
  node(source, 'app', 'value', 'Literal', { type: intType, value: 5 })
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(typeOf(analysis, 'call'), intType)
  assert.deepEqual(simulateProgram(source).output, ['5'])
  const javascript = transpileProgram(source)
  assert.equal(javascript.ok, true, JSON.stringify(javascript.diagnostics))
  assert.equal(execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8', timeout: 3000 }).trim(), '5')
  const python = transpileProgram(source, { target: 'python' })
  assert.equal(python.ok, true, JSON.stringify(python.diagnostics))
  assert.equal(execFileSync('python', ['-c', python.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim(), '5')
})

test('généricité : insertion d’un appel puis de son argument dans un emplacement typé', () => {
  const source = genericProgram()
  root(source, 'm', 'result', 'VariableDeclaration', { name: 'result', type: intType }, { initializer: null })
  let sequence = 0
  const bundle = createNodeBundle('m', { kind: 'CallExpression', children: { callee: { kind: 'Reference', references: { target: { kind: 'node', nodeId: 'identity' } } }, arguments: [] } }, () => `inserted${sequence += 1}`)
  const inserted = insertSourceNodes(source, { targetId: 'result', slot: 'initializer' }, bundle, { index: createContextIndex(source, analyzeProgram(source)) })
  assert.equal(inserted.ok, true, inserted.code)
  const argument = createNodeBundle('m', { kind: 'Literal', properties: { type: intType, value: 7 } }, () => `argument${sequence += 1}`)
  const completed = insertSourceNodes(inserted.project, { targetId: inserted.nodeId, slot: 'arguments' }, argument, { index: inserted.index })
  assert.equal(completed.ok, true, completed.code)
  assert.deepEqual(completed.analysis.semantic.nodeTypes.find((entry) => entry.nodeId === inserted.nodeId)?.type, intType)
})

test('généricité : le workspace conserve le drapeau et le type T', () => {
  const source = genericProgram()
  const cards = source.modules.map((module) => ({ id: module.id, type: 'module', name: module.name, x: 0, y: 0, width: 320, height: 220, expandedNodeIds: [] }))
  const text = serializeWorkspace(source, cards, { x: 0, y: 0, zoomLevel: 0 })
  const restored = deserializeWorkspace(text).project
  assert.equal(restored.nodes.find((entry) => entry.id === 'identity').properties.generic, true)
  assert.deepEqual(restored.nodes.find((entry) => entry.id === 'identityValue').properties.type, genericT)
  assert.deepEqual(analyzeProgram(restored).diagnostics.filter((entry) => entry.severity === 'error'), [])
})
