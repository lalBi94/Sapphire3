import { createModule, createNode } from './logic/model.js'
import { rgbLedGlobalName, rgbLedChannels } from './logic/rgbLedState.js'

export { rgbLedGlobalName } from './logic/rgbLedState.js'

export const rgbLedDefaults = Object.freeze({ red: 0, green: 0, blue: 0 })
export const rgbLedMaximum = 255

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Produit le nom stable d'une fonction d'API interne à une LED RVB.
export function rgbLedFunctionName(kind, index) {
  return `RGBLED_SP3_${kind}_${index}`
}

// Crée le module caché d'une LED RVB avec ses trois canaux entiers et ses fonctions exportées.
export function createRgbLedModule(moduleId, name, index, options = {}) {
  const initial = Object.fromEntries(rgbLedChannels.map(([key]) => {
    const value = options[key]
    return [key, Number.isInteger(value) ? Math.min(rgbLedMaximum, Math.max(0, value)) : rgbLedDefaults[key]]
  }))
  const module = createModule(moduleId, name)
  module.rgbLed = { index }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `rgbLed:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const intValue = (suffix, value) => node(suffix, 'Literal', { type: intType, value: String(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const returnValue = (suffix, value) => node(suffix, 'ReturnStatement', {}, { argument: value })

  // Une globale entière par canal : trois déclarations, aucun appel initial coûteux.
  const names = Object.fromEntries(rgbLedChannels.map(([key, label]) => [key, rgbLedGlobalName(label, index)]))
  for (const [key] of rgbLedChannels) {
    const declaration = node(key, 'VariableDeclaration', { name: names[key], type: intType }, { initializer: intValue(`${key}Start`, initial[key]) })
    module.rootNodeIds.push(declaration)
  }

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, returnType, parameters, statements) {
    const functionName = rgbLedFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name: functionName, type: returnType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  const setColor = addFunction('SET_COLOR', voidType, rgbLedChannels.map(([key]) => ({ id: `parameter:${key}`, name: key, type: intType })), rgbLedChannels.map(([key]) => (
    assignment(`assign:${key}`, ref(`${key}Target`, names[key]), ref(`${key}Param`, key))
  )))
  const getRed = addFunction('GET_RED', intType, [], [returnValue('redReturn', ref('redReturnRef', names.red))])
  const getGreen = addFunction('GET_GREEN', intType, [], [returnValue('greenReturn', ref('greenReturnRef', names.green))])
  const getBlue = addFunction('GET_BLUE', intType, [], [returnValue('blueReturn', ref('blueReturnRef', names.blue))])

  return {
    module,
    nodes,
    functions: { setColor, getRed, getGreen, getBlue, names },
  }
}
