import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Construit un programme minimal dont l’entrée affiche une valeur constante.
function printProgram(value = 42) {
  const project = createProject('simulation')
  project.modules = [createModule('module', 'Simulation')]
  project.modules[0].rootNodeIds = ['main']
  project.nodes = [
    createNode('main', 'module', 'FunctionDeclaration', { properties: { name: 'main', type: voidType, entryPoint: true }, children: { parameters: [], body: 'body' } }),
    createNode('body', 'module', 'Block', { children: { statements: ['print'] } }),
    createNode('print', 'module', 'PrintStatement', { children: { value: 'literal' } }),
    createNode('literal', 'module', 'Literal', { properties: { type: intType, value } }),
  ]
  return project
}

test('PrintStatement est typé et produit une sortie déterministe', () => {
  const project = printProgram()
  assert.deepEqual(analyzeProgram(project).diagnostics, [])
  const result = simulateProgram(project)
  assert.deepEqual(result.output, ['42'])
  assert.deepEqual(result.trace, ['print', 'literal'])
})

test('la simulation refuse un programme qui possède des diagnostics bloquants', () => {
  const project = printProgram()
  project.nodes.find((node) => node.id === 'literal').properties.type = { kind: 'primitive', name: 'void' }
  const result = simulateProgram(project)
  assert.equal(result.ok, false)
  assert.equal(result.output.length, 0)
})
