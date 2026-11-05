import { createModule, createNode } from './logic/model.js'
import { ledGlobalName } from './logic/ledState.js'

export { ledGlobalName } from './logic/ledState.js'

export const ledDefaults = Object.freeze({ value: false })

const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }

// Produit le nom stable d'une fonction d'API interne à une LED.
export function ledFunctionName(kind, index) {
  return `LED_SP3_${kind}_${index}`
}

// Crée le module caché d'une LED avec sa globale booléenne et ses fonctions exportées.
export function createLedModule(moduleId, name, index, options = {}) {
  const initial = Boolean(options.value)
  const module = createModule(moduleId, name)
  module.led = { index }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `led:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const boolean = (suffix, value) => node(suffix, 'Literal', { type: booleanType, value: Boolean(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const returnValue = (suffix, value) => node(suffix, 'ReturnStatement', {}, { argument: value })

  const valueName = ledGlobalName(index)
  const valueId = node('value', 'VariableDeclaration', { name: valueName, type: booleanType }, { initializer: boolean('valueStart', initial) })
  module.rootNodeIds.push(valueId)

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, returnType, parameters, statements) {
    const functionName = ledFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name: functionName, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  const setValue = addFunction('SET_VALUE', voidType, [{ id: 'parameter:value', name: 'value', type: booleanType }], [
    assignment('assignValue', ref('valueTarget', valueName), ref('valueParam', 'value')),
  ])
  const getValue = addFunction('GET_VALUE', booleanType, [], [returnValue('valueReturn', ref('valueReturnRef', valueName))])
  // `not` inverse directement la globale booléenne.
  const toggle = addFunction('TOGGLE', voidType, [], [
    assignment('toggleValue', ref('toggleTarget', valueName), node('toggleNot', 'UnaryExpression', { operator: 'not' }, { operand: ref('toggleOperand', valueName) })),
  ])

  return {
    module,
    nodes,
    functions: { setValue, getValue, toggle, names: { value: valueName } },
  }
}