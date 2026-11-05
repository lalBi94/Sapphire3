import { createModule, createNode } from './logic/model.js'
import { heatmapDefaults, heatmapGlobalName, heatmapMaximumDimension } from './logic/heatmapState.js'

export { heatmapDefaults } from './logic/heatmapState.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }
const arrayType = { kind: 'array', elementType: intType }

// Construit une grille fixe et deux fonctions ordinaires, sans opération native supplémentaire.
export function createHeatmapModule(moduleId, name, index, options = {}) {
  const width = Number.isInteger(options.width) && options.width > 0 && options.width <= heatmapMaximumDimension ? options.width : heatmapDefaults.width
  const height = Number.isInteger(options.height) && options.height > 0 && options.height <= heatmapMaximumDimension ? options.height : heatmapDefaults.height
  const module = createModule(moduleId, name)
  module.heatmap = { index, width, height }
  const nodes = []
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const id = `heatmap:${moduleId}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const literal = (value) => node('Literal', { type: intType, value: String(value) })
  const ref = (name) => node('Reference', {}, {}, { target: { kind: 'name', name } })
  const binary = (operator, left, right) => node('BinaryExpression', { operator }, { left, right })
  const block = (statements) => node('Block', {}, { statements })
  const fill = () => node('MathCall', { name: 'arrayFill' }, { arguments: [literal(width * height), literal(0)] })
  const data = heatmapGlobalName(index)
  module.rootNodeIds.push(node('VariableDeclaration', { name: data, type: arrayType }, { initializer: fill() }))

  // Publie une procédure typée dans le module caché.
  function addFunction(kind, parameterNames, statements) {
    const name = `HEATMAP_SP3_${kind}_${index}`
    const parameters = parameterNames.map((name) => node('Parameter', { name, type: intType }))
    const id = node('FunctionDeclaration', { name, type: voidType }, { parameters, body: block(statements) })
    module.rootNodeIds.push(id)
    module.exports.push({ nodeId: id, name })
  }

  const validX = binary('and', binary('>=', ref('x'), literal(0)), binary('<', ref('x'), literal(width)))
  const validY = binary('and', binary('>=', ref('y'), literal(0)), binary('<', ref('y'), literal(height)))
  const offset = binary('+', binary('*', ref('y'), literal(width)), ref('x'))
  const target = node('ArrayAccess', {}, { array: ref(data), index: offset })
  const write = node('AssignmentStatement', {}, { target, value: ref('value') })
  // Une coordonnée invalide produit l'erreur de bornes existante, sans repli sur une autre ligne.
  const invalidTarget = node('ArrayAccess', {}, { array: ref(data), index: literal(-1) })
  const invalidWrite = node('AssignmentStatement', {}, { target: invalidTarget, value: literal(0) })
  const guard = node('IfStatement', {}, { test: binary('and', validX, validY), consequent: block([write]), alternate: block([invalidWrite]) })
  addFunction('SET_CELL', ['x', 'y', 'value'], [guard])
  addFunction('CLEAR', [], [node('AssignmentStatement', {}, { target: ref(data), value: fill() })])
  return { module, nodes }
}
