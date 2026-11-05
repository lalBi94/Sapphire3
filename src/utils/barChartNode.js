import { createModule, createNode } from './logic/model.js'
import { barChartGlobalName, maximumBarChartBars } from './logic/barChartState.js'

export { barChartGlobalName } from './logic/barChartState.js'

export const barChartDefaults = Object.freeze({ size: 12 })

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }

// Produit le nom stable d'une fonction d'API interne à un graphique à barres.
export function barChartFunctionName(kind, index) {
  return `BARCHART_SP3_${kind}_${index}`
}

// Crée le module caché d'un graphique avec ses données et ses trois fonctions exportées.
export function createBarChartModule(moduleId, name, index, options = {}) {
  const size = Number.isInteger(options.size) && options.size > 0 ? Math.min(options.size, maximumBarChartBars) : barChartDefaults.size
  const module = createModule(moduleId, name)
  module.barChart = { index }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `barChart:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const intValue = (suffix, value) => node(suffix, 'Literal', { type: intType, value: String(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const assignment = (suffix, target, value) => node(suffix, 'AssignmentStatement', {}, { target, value })
  const access = (suffix, array, indexNode) => node(suffix, 'ArrayAccess', {}, { array, index: indexNode })
  const native = (suffix, name, args) => node(suffix, 'MathCall', { name }, { arguments: args })

  // Les barres démarrent à zéro : un tableau littéral de taille fixe, simple à relire.
  const data = barChartGlobalName('DATA', index)
  const elements = []
  for (let position = 0; position < size; position += 1) elements.push(intValue(`start:${position}`, 0))
  const initializer = node('initializer', 'ArrayLiteral', { elementType: intType }, { elements })
  const dataId = node('data', 'VariableDeclaration', { name: data, type: intArrayType }, { initializer })
  module.rootNodeIds.push(dataId)

  // Ajoute une fonction racine exportable et retourne son nom publié.
  function addFunction(kind, parameters, statements) {
    const functionName = barChartFunctionName(kind, index)
    const parameterIds = parameters.map((parameter) => node(parameter.id, 'Parameter', { name: parameter.name, type: parameter.type }))
    const bodyId = block(`body:${kind}`, statements)
    const functionId = node(`function:${kind}`, 'FunctionDeclaration', { name: functionName, type: voidType }, { parameters: parameterIds, body: bodyId })
    module.rootNodeIds.push(functionId)
    module.exports.push({ nodeId: functionId, name: functionName })
    return functionName
  }

  const setValue = addFunction('SET_VALUE', [
    { id: 'parameter:index', name: 'index', type: intType },
    { id: 'parameter:value', name: 'value', type: intType },
  ], [
    assignment('assignValue', access('valueTarget', ref('valueArray', data), ref('valueIndex', 'index')), ref('valueParam', 'value')),
  ])
  const setData = addFunction('SET_DATA', [{ id: 'parameter:values', name: 'values', type: intArrayType }], [
    assignment('assignData', ref('dataTarget', data), ref('dataParam', 'values')),
  ])
  const clearLength = native('length', 'arrayLength', [ref('lengthData', data)])
  const clearFill = native('fill', 'arrayFill', [clearLength, intValue('clearZero', 0)])
  const clear = addFunction('CLEAR', [], [
    assignment('clearData', ref('clearTarget', data), clearFill),
  ])

  return {
    module,
    nodes,
    functions: { setValue, setData, clear, data },
  }
}
