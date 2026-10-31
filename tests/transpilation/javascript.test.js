import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createModule, createNode, createProject } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

// Construit un programme minimal avec un point d’entrée et une sortie observable.
function simpleProgram() {
  const project = createProject('transpile')
  project.modules = [createModule('module', 'Module')]
  project.modules[0].rootNodeIds = ['entry']
  project.nodes = [
    createNode('entry', 'module', 'FunctionDeclaration', {
      properties: { name: 'start', type: { kind: 'primitive', name: 'void' }, entryPoint: true },
      children: { parameters: [], body: 'body' },
    }),
    createNode('body', 'module', 'Block', { children: { statements: ['print', 'return'] } }),
    createNode('print', 'module', 'PrintStatement', { children: { value: 'literal' } }),
    createNode('literal', 'module', 'Literal', { properties: { type: { kind: 'primitive', name: 'string' }, value: 'hello' } }),
    createNode('return', 'module', 'ReturnStatement', { children: { argument: null } }),
  ]
  return project
}

test('JavaScript transpilation generates and executes a single file', () => {
  const result = transpileProgram(simpleProgram(), { target: 'javascript' })
  assert.equal(result.ok, true)
  assert.match(result.code, /function main\(\)/)
  assert.match(result.code, /main\(\);/)
  assert.equal(execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8' }).trim(), 'hello')
})

test('JavaScript transpilation requires exactly one entry point', () => {
  const project = simpleProgram()
  project.nodes[0].properties.entryPoint = false
  const result = transpileProgram(project, { target: 'javascript' })
  assert.equal(result.ok, false)
  assert.equal(result.diagnostics.some(({ code }) => code === 'TRANSPILE_ENTRY_POINT_REQUIRED'), true)
})

test('JavaScript transpilation keeps numeric literals serialized as text', () => {
  const project = simpleProgram()
  project.nodes.find((node) => node.id === 'literal').properties = { type: { kind: 'primitive', name: 'int' }, value: '42' }
  const result = transpileProgram(project, { target: 'javascript' })
  assert.equal(result.ok, true)
  assert.equal(execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8' }).trim(), '42')
})
