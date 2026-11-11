import { readFileSync } from 'node:fs'
import { createModule, createNode, createProject } from '../../src/utils/logic/index.js'

export const intType = Object.freeze({ kind: 'primitive', name: 'int' })
export const voidType = Object.freeze({ kind: 'primitive', name: 'void' })

// Lit un manifeste d'exemple livré avec le dépôt.
export function readExamplePlugin(name) {
  return JSON.parse(readFileSync(new URL(`../../examples/plugins/${name}.sp3plugin`, import.meta.url), 'utf8'))
}

// Construit un programme minimal qui appelle une opération native entière.
export function buildNativeProject(operationId = 'pluginClamp') {
  const project = createProject('plugin-native')
  const module = createModule('app', 'App')
  module.rootNodeIds.push('main')
  project.modules.push(module)
  const add = (id, kind, properties = {}, children = {}, references = {}) => {
    project.nodes.push(createNode(id, 'app', kind, { properties, children, references }))
  }
  add('main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  add('body', 'Block', {}, { statements: ['value', 'print'] })
  add('value', 'VariableDeclaration', { name: 'value', type: intType }, { initializer: 'call' })
  add('call', 'MathCall', { name: operationId }, { arguments: ['twelve', 'zero', 'five'] })
  add('twelve', 'Literal', { type: intType, value: 12 })
  add('zero', 'Literal', { type: intType, value: 0 })
  add('five', 'Literal', { type: intType, value: 5 })
  add('print', 'PrintStatement', {}, { value: 'valueReference' })
  add('valueReference', 'Reference', {}, {}, { target: { kind: 'name', name: 'value' } })
  return project
}
