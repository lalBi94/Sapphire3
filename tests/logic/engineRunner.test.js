import assert from 'node:assert/strict'
import test from 'node:test'
import { runSimulation, runTranspilation, runTranspilationChecks, cancelEngineWork, isEngineCancelled } from '../../src/services/engineRunner.js'
import { program, root, node, intType, booleanType } from './fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }

// Programme avec une boucle assez longue pour produire plusieurs messages d'avancement.
function longLoopProgram() {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  node(source, 'm', 'body', 'Block', {}, { statements: ['init', 'while'] })
  node(source, 'm', 'init', 'VariableDeclaration', { name: 'i', type: intType }, { initializer: 'zero' })
  node(source, 'm', 'zero', 'Literal', { type: intType, value: 0 })
  node(source, 'm', 'while', 'WhileStatement', {}, { test: 'less', body: 'loopBody' })
  node(source, 'm', 'less', 'BinaryExpression', { operator: '<' }, { left: 'iRef', right: 'limit' })
  node(source, 'm', 'iRef', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'init' } })
  node(source, 'm', 'limit', 'Literal', { type: intType, value: 600 })
  node(source, 'm', 'loopBody', 'Block', {}, { statements: ['increment'] })
  node(source, 'm', 'increment', 'AssignmentStatement', {}, { target: 'iTarget', value: 'plus' })
  node(source, 'm', 'iTarget', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'init' } })
  node(source, 'm', 'plus', 'BinaryExpression', { operator: '+' }, { left: 'iRead', right: 'one' })
  node(source, 'm', 'iRead', 'Reference', {}, {}, { target: { kind: 'node', nodeId: 'init' } })
  node(source, 'm', 'one', 'Literal', { type: intType, value: 1 })
  return source
}

test('worker : la simulation signale son avancement et son résultat sérialisable', async () => {
  const source = longLoopProgram()
  const progress = []
  const result = await runSimulation(source, {}, { onProgress: (entry) => progress.push(entry) })
  assert.equal(result.ok, true, result.errorCode)
  assert.ok(progress.some((entry) => entry.phase === 'simulation' && entry.current >= 500))
  assert.ok(progress.every((entry) => entry.total > 0 && entry.current <= entry.total))
  cancelEngineWork()
})

test('worker : la transpilation analyse puis génère avec avancement', async () => {
  const source = longLoopProgram()
  const progress = []
  const result = await runTranspilation(source, { target: 'javascript' }, { onProgress: (entry) => progress.push(entry) })
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  assert.ok(progress.some((entry) => entry.phase === 'analysis'))
  assert.ok(progress.some((entry) => entry.phase === 'generate' && entry.target === 'javascript'))
  assert.equal('analysis' in result, false)
})

test('worker : les vérifications transpilent toutes les cibles après une seule analyse', async () => {
  const source = longLoopProgram()
  const checks = await runTranspilationChecks(source, ['javascript', 'python'])
  assert.deepEqual(checks, { javascript: 'ok', python: 'ok' })
})

test('worker : une demande déjà annulée est rejetée immédiatement', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(runSimulation(longLoopProgram(), {}, { signal: controller.signal }), (error) => isEngineCancelled(error))
  cancelEngineWork()
})
