import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { analyzeProgram, moduleInitializationOrder, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Programme : App initialise `result` en appelant une fonction de Lib qui lit sa globale `base`.
function crossModuleProgram() {
  const source = program('app', 'lib')

  root(source, 'app', 'result', 'VariableDeclaration', { name: 'result', type: intType }, { initializer: 'answerCall' })
  node(source, 'app', 'answerCall', 'CallExpression', {}, { callee: 'answerRef', arguments: [] })
  node(source, 'app', 'answerRef', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })
  root(source, 'app', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'mainBody' })
  node(source, 'app', 'mainBody', 'Block', {}, { statements: ['printResult'] })
  node(source, 'app', 'printResult', 'PrintStatement', {}, { value: 'resultRef' })
  node(source, 'app', 'resultRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'result' } })

  root(source, 'lib', 'base', 'VariableDeclaration', { name: 'base', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'lib', 'fortyTwo', 'Literal', { type: intType, value: 42 })
  root(source, 'lib', 'answer', 'FunctionDeclaration', { name: 'answer', type: intType }, { parameters: [], body: 'answerBody' })
  node(source, 'lib', 'answerBody', 'Block', {}, { statements: ['returnBase'] })
  node(source, 'lib', 'returnBase', 'ReturnStatement', {}, { argument: 'baseRef' })
  node(source, 'lib', 'baseRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'base' } })

  const app = source.modules.find((module) => module.id === 'app')
  const lib = source.modules.find((module) => module.id === 'lib')
  app.imports.push({ id: 'answerImport', moduleId: 'lib', nodeId: 'answer', localName: 'answer' })
  lib.exports.push({ nodeId: 'answer', name: 'answer' })
  return source
}

// Exécute le code transpilé et renvoie ses lignes.
function execute(target, code) {
  const output = target === 'python'
    ? execFileSync('python', ['-c', code], { encoding: 'utf8', timeout: 3000 })
    : execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 3000 })
  return output.trim().split(/\r?\n/)
}

test('initialisation globale : un module consommateur passe après ses dépendances', () => {
  const source = crossModuleProgram()
  const analysis = analyzeProgram(source)
  assert.deepEqual(analysis.diagnostics.filter((entry) => entry.severity === 'error'), [])
  assert.deepEqual(moduleInitializationOrder(source, analysis).map((module) => module.id), ['lib', 'app'])

  const simulation = simulateProgram(source)
  assert.equal(simulation.ok, true, simulation.errorCode)
  assert.deepEqual(simulation.output, ['42'])

  for (const target of ['javascript', 'python']) {
    const generated = transpileProgram(source, { target })
    assert.equal(generated.ok, true, `${target}: ${JSON.stringify(generated.diagnostics)}`)
    assert.deepEqual(execute(target, generated.code), ['42'], target)
  }
})
