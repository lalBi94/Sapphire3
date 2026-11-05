import { createModule, createNode } from './logic/model.js'
import { progressGlobalName } from './logic/progressState.js'

export { progressGlobalName } from './logic/progressState.js'

export const progressDefaults = Object.freeze({ min: 0, max: 100 })

const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }

// Produit le nom stable d'une fonction d'API interne à une barre de progression.
export function progressFunctionName(kind, index) {
  return `PROGRESS_SP3_${kind}_${index}`
}

// Crée le module caché d'une barre avec ses globales et ses quatre fonctions exportées.
export function createProgressModule(moduleId, name, index, options = {}) {
  const minimum = Number.isFinite(options.min) ? options.min : progressDefaults.min
  const maximum = Number.isFinite(options.max) && options.max > minimum ? options.max : Math.max(progressDefaults.max, minimum + 1)
  const module = createModule(moduleId, name)
  module.progress = { index, min: minimum, max: maximum }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `progress:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const number = (suffix, value) => node(suffix, 'Literal', { type: doubleType, value: String(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const returnValue = (suffix, value) => node(suffix, 'ReturnStatement', {}, { argument: value })
  const binary = (suffix, operator, left, right) => node(suffix, 'BinaryExpression', { operator }, { left, right })

  const names = {
    value: progressGlobalName('VALUE', index),
    min: progressGlobalName('MIN', index),
    max: progressGlobalName('MAX', index),
  }
  // Trois globales seulement : aucune initialisation coûteuse en pas de simulation.
  const valueId = node('value', 'VariableDeclaration', { name: names.value, type: doubleType }, { initializer: number('valueStart', minimum) })
  const minId = node('min', 'VariableDeclaration', { name: names.min, type: doubleType }, { initializer: number('minStart', minimum) })
  const maxId = node('max', 'VariableDeclaration', { name: names.max, type: doubleType }, { initializer: number('maxStart', maximum) })
  module.rootNodeIds.push(valueId, minId, maxId)

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, returnType, parameters, statements) {
    const functionName = progressFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name: functionName, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  const setValue = addFunction('SET_VALUE', voidType, [{ id: 'parameter:value', name: 'value', type: doubleType }], [
    assignment('assignValue', ref('valueTarget', names.value), ref('valueParam', 'value')),
  ])
  const addValue = addFunction('ADD_VALUE', voidType, [{ id: 'parameter:delta', name: 'delta', type: doubleType }], [
    assignment('addValue', ref('addTarget', names.value), binary('addSum', '+', ref('addLeft', names.value), ref('addRight', 'delta'))),
  ])
  const getValue = addFunction('GET_VALUE', doubleType, [], [returnValue('valueReturn', ref('valueReturnRef', names.value))])
  const setRange = addFunction('SET_RANGE', voidType, [
    { id: 'parameter:minimum', name: 'minimum', type: doubleType },
    { id: 'parameter:maximum', name: 'maximum', type: doubleType },
  ], [
    assignment('assignMin', ref('minTarget', names.min), ref('minParam', 'minimum')),
    assignment('assignMax', ref('maxTarget', names.max), ref('maxParam', 'maximum')),
  ])

  return {
    module,
    nodes,
    functions: { setValue, addValue, getValue, setRange, names },
  }
}
