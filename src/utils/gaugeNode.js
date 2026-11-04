import { createModule, createNode } from './logic/model.js'
import { gaugeGlobalName } from './logic/gaugeState.js'

export { gaugeGlobalName } from './logic/gaugeState.js'

export const gaugeDefaults = Object.freeze({ min: 0, max: 100 })

const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }

// Produit le nom stable d'une fonction d'API interne à une jauge.
export function gaugeFunctionName(kind, index) {
  return `GAUGE_SP3_${kind}_${index}`
}

// Crée le module caché d'une jauge avec ses globales et ses fonctions exportées.
export function createGaugeModule(moduleId, name, index, options = {}) {
  const minimum = Number.isFinite(options.min) ? options.min : gaugeDefaults.min
  const maximum = Number.isFinite(options.max) && options.max > minimum ? options.max : Math.max(gaugeDefaults.max, minimum + 1)
  const module = createModule(moduleId, name)
  module.gauge = { index, min: minimum, max: maximum }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `gauge:${moduleId}:${suffix}:${++sequence}`
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
    value: gaugeGlobalName('VALUE', index),
    min: gaugeGlobalName('MIN', index),
    max: gaugeGlobalName('MAX', index),
  }
  // Trois globales seulement : aucune initialisation coûteuse en pas de simulation.
  const valueId = node('value', 'VariableDeclaration', { name: names.value, type: doubleType }, { initializer: number('valueStart', minimum) })
  const minId = node('min', 'VariableDeclaration', { name: names.min, type: doubleType }, { initializer: number('minStart', minimum) })
  const maxId = node('max', 'VariableDeclaration', { name: names.max, type: doubleType }, { initializer: number('maxStart', maximum) })
  module.rootNodeIds.push(valueId, minId, maxId)

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, returnType, parameters, statements) {
    const functionName = gaugeFunctionName(kind, index)
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
  const getMin = addFunction('GET_MIN', doubleType, [], [returnValue('minReturn', ref('minReturnRef', names.min))])
  const getMax = addFunction('GET_MAX', doubleType, [], [returnValue('maxReturn', ref('maxReturnRef', names.max))])
  const setRange = addFunction('SET_RANGE', voidType, [
    { id: 'parameter:minimum', name: 'minimum', type: doubleType },
    { id: 'parameter:maximum', name: 'maximum', type: doubleType },
  ], [
    assignment('assignMin', ref('minTarget', names.min), ref('minParam', 'minimum')),
    assignment('assignMax', ref('maxTarget', names.max), ref('maxParam', 'maximum')),
  ])
  const reset = addFunction('RESET', voidType, [], [
    assignment('resetValue', ref('resetTarget', names.value), ref('resetMin', names.min)),
  ])

  return {
    module,
    nodes,
    functions: { setValue, addValue, getValue, getMin, getMax, setRange, reset, names },
  }
}