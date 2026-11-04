import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType, stringType } from '../logic/fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const charType = { kind: 'primitive', name: 'char' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const intArrayType = { kind: 'array', elementType: intType }
const stringArrayType = { kind: 'array', elementType: stringType }

// Compose un programme qui imprime les résultats des nouvelles opérations natives.
function operationsProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['values', 'slice', 'concat', 'index', 'contains', 'reverseLength', 'text', 'comma', 'parts', 'joined', 'textIndex', 'printIndex', 'printContains', 'printReverseLength', 'printJoined', 'printTextIndex'] })
  node(source, 'm', 'values', 'VariableDeclaration', { name: 'values', type: intArrayType }, { initializer: 'items' })
  node(source, 'm', 'items', 'ArrayLiteral', { elementType: intType }, { elements: ['one', 'two', 'three'] })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'two', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'three', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'slice', 'VariableDeclaration', { name: 'slice', type: intArrayType }, { initializer: 'sliceCall' })
  node(source, 'm', 'sliceCall', 'MathCall', { name: 'arraySlice' }, { arguments: ['valuesRef', 'zero', 'twoIndex'] })
  node(source, 'm', 'valuesRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  node(source, 'm', 'twoIndex', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'concat', 'VariableDeclaration', { name: 'concat', type: intArrayType }, { initializer: 'concatCall' })
  node(source, 'm', 'concatCall', 'MathCall', { name: 'arrayConcat' }, { arguments: ['valuesRefConcat', 'sliceRef'] })
  node(source, 'm', 'valuesRefConcat', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'sliceRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'slice' } })
  node(source, 'm', 'index', 'VariableDeclaration', { name: 'index', type: intType }, { initializer: 'indexCall' })
  node(source, 'm', 'indexCall', 'MathCall', { name: 'arrayIndexOf' }, { arguments: ['concatRef', 'twoValue'] })
  node(source, 'm', 'concatRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'concat' } })
  node(source, 'm', 'twoValue', 'Literal', { type: intType, value: 2 })
  node(source, 'm', 'contains', 'VariableDeclaration', { name: 'contains', type: booleanType }, { initializer: 'containsCall' })
  node(source, 'm', 'containsCall', 'MathCall', { name: 'arrayContains' }, { arguments: ['valuesRefContains', 'threeValue'] })
  node(source, 'm', 'valuesRefContains', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'threeValue', 'Literal', { type: intType, value: 3 })
  node(source, 'm', 'reverseLength', 'VariableDeclaration', { name: 'reverseLength', type: intType }, { initializer: 'lengthCall' })
  node(source, 'm', 'lengthCall', 'MathCall', { name: 'arrayLength' }, { arguments: ['reverseCall'] })
  node(source, 'm', 'reverseCall', 'MathCall', { name: 'arrayReverse' }, { arguments: ['valuesRefReverse'] })
  node(source, 'm', 'valuesRefReverse', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'values' } })
  node(source, 'm', 'text', 'VariableDeclaration', { name: 'text', type: stringType }, { initializer: 'textValue' })
  node(source, 'm', 'textValue', 'Literal', { type: stringType, value: 'a,b' })
  node(source, 'm', 'comma', 'VariableDeclaration', { name: 'comma', type: charType }, { initializer: 'commaValue' })
  node(source, 'm', 'commaValue', 'Literal', { type: charType, value: ',' })
  node(source, 'm', 'parts', 'VariableDeclaration', { name: 'parts', type: stringArrayType }, { initializer: 'partsCall' })
  node(source, 'm', 'partsCall', 'MathCall', { name: 'stringSplit' }, { arguments: ['textRef', 'commaRef'] })
  node(source, 'm', 'textRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  node(source, 'm', 'commaRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'comma' } })
  node(source, 'm', 'joined', 'VariableDeclaration', { name: 'joined', type: stringType }, { initializer: 'joinedCall' })
  node(source, 'm', 'joinedCall', 'MathCall', { name: 'stringJoin' }, { arguments: ['partsRef', 'separator'] })
  node(source, 'm', 'partsRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'parts' } })
  node(source, 'm', 'separator', 'Literal', { type: stringType, value: '|' })
  node(source, 'm', 'textIndex', 'VariableDeclaration', { name: 'textIndex', type: intType }, { initializer: 'textIndexCall' })
  node(source, 'm', 'textIndexCall', 'MathCall', { name: 'stringIndexOf' }, { arguments: ['textRefIndex', 'search'] })
  node(source, 'm', 'textRefIndex', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'text' } })
  node(source, 'm', 'search', 'Literal', { type: stringType, value: 'b' })
  for (const [id, value] of [['printIndex', 'index'], ['printContains', 'contains'], ['printReverseLength', 'reverseLength'], ['printJoined', 'joined'], ['printTextIndex', 'textIndex']]) {
    node(source, 'm', `${id}Ref`, 'Reference', {}, {}, { target: { kind: 'node', nodeId: value } })
    node(source, 'm', id, 'PrintStatement', {}, { value: `${id}Ref` })
  }
  return source
}

test('nouvelles opérations natives : JavaScript généré reproduit le simulateur', () => {
  const project = operationsProgram()
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, JSON.stringify(simulation.diagnostics ?? simulation))
  const generated = transpileProgram(project)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /sapphireArraySlice/)
  assert.match(generated.code, /sapphireArrayIndexOf/)
  assert.match(generated.code, /sapphireStringIndexOf/)
  const expected = simulation.output.map((line) => `${line}\n`).join('')
  const output = execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8', timeout: 3000 }).replace(/\r\n/g, '\n')
  assert.equal(output, expected)
})

test('nouvelles opérations natives : Python généré reproduit le simulateur', () => {
  const project = operationsProgram()
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, JSON.stringify(simulation.diagnostics ?? simulation))
  const generated = transpileProgram(project, { target: 'python' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /sapphireArraySlice/)
  assert.match(generated.code, /sapphireArrayIndexOf/)
  const expected = simulation.output.map((line) => `${line}\n`).join('')
  const output = execFileSync('python', ['-c', generated.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).replace(/\r\n/g, '\n')
  assert.equal(output, expected)
})
