import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType } from '../logic/fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const doubleType = { kind: 'primitive', name: 'double' }

// Compose un programme qui imprime les contrôles de plage des deux aléas.
function randomProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['doubleValue', 'intValue', 'printLow', 'printHigh', 'printMin', 'printMax'] })

  node(source, 'm', 'doubleValue', 'VariableDeclaration', { name: 'value', type: doubleType }, { initializer: 'doubleCall' })
  node(source, 'm', 'doubleCall', 'MathCall', { name: 'randomDouble' }, { arguments: [] })
  node(source, 'm', 'intValue', 'VariableDeclaration', { name: 'count', type: intType }, { initializer: 'intCall' })
  node(source, 'm', 'intCall', 'MathCall', { name: 'randomInt' }, { arguments: ['one', 'six'] })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  node(source, 'm', 'six', 'Literal', { type: intType, value: 6 })

  node(source, 'm', 'printLow', 'PrintStatement', {}, { value: 'lowCheck' })
  node(source, 'm', 'lowCheck', 'BinaryExpression', { operator: '>=' }, { left: 'valueLow', right: 'zeroDouble' })
  node(source, 'm', 'valueLow', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'doubleValue' } })
  node(source, 'm', 'zeroDouble', 'Literal', { type: doubleType, value: 0.0 })

  node(source, 'm', 'printHigh', 'PrintStatement', {}, { value: 'highCheck' })
  node(source, 'm', 'highCheck', 'BinaryExpression', { operator: '<' }, { left: 'valueHigh', right: 'oneDouble' })
  node(source, 'm', 'valueHigh', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'doubleValue' } })
  node(source, 'm', 'oneDouble', 'Literal', { type: doubleType, value: 1.0 })

  node(source, 'm', 'printMin', 'PrintStatement', {}, { value: 'minCheck' })
  node(source, 'm', 'minCheck', 'BinaryExpression', { operator: '>=' }, { left: 'countMin', right: 'oneInt' })
  node(source, 'm', 'countMin', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'intValue' } })
  node(source, 'm', 'oneInt', 'Literal', { type: intType, value: 1 })

  node(source, 'm', 'printMax', 'PrintStatement', {}, { value: 'maxCheck' })
  node(source, 'm', 'maxCheck', 'BinaryExpression', { operator: '<=' }, { left: 'countMax', right: 'sixInt' })
  node(source, 'm', 'countMax', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'intValue' } })
  node(source, 'm', 'sixInt', 'Literal', { type: intType, value: 6 })

  return source
}

test('opérations aléatoires : JavaScript généré respecte les plages du simulateur', () => {
  const project = randomProgram()
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, simulation.errorCode)
  assert.deepEqual(simulation.output, ['true', 'true', 'true', 'true'])
  const generated = transpileProgram(project)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /Math\.random\(\)/)
  assert.match(generated.code, /sapphireRandomInt/)
  const output = execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8', timeout: 3000 }).replace(/\r\n/g, '\n')
  assert.equal(output, 'true\ntrue\ntrue\ntrue\n')
})

test('opérations aléatoires : Python généré respecte les plages du simulateur', () => {
  const project = randomProgram()
  const generated = transpileProgram(project, { target: 'python' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /_sapphireRandom\.random\(\)/)
  assert.match(generated.code, /_sapphireRandom\.randint/)
  const output = execFileSync('python', ['-c', generated.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).replace(/\r\n/g, '\n')
  assert.equal(output, 'true\ntrue\ntrue\ntrue\n')
})
