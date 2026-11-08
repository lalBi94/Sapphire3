import { createModule, createNode } from './logic/model.js'
import { inputButtonGlobalName } from './logic/inputButtonState.js'

export { inputButtonGlobalName } from './logic/inputButtonState.js'

export const inputButtonDefaults = Object.freeze({ pressed: false })

const booleanType = { kind: 'primitive', name: 'boolean' }

// Crée le module caché d'un bouton : une globale booléenne et un accesseur exporté.
export function createInputButtonModule(moduleId, name, index, options = {}) {
  const mode = options.mode === 'hold' ? 'hold' : 'toggle'
  const initial = Boolean(options.pressed)
  const module = createModule(moduleId, name)
  module.inputButton = { index, mode }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `input:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const boolean = (suffix, value) => node(suffix, 'Literal', { type: booleanType, value: Boolean(value) })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })
  const returnValue = (suffix, value) => node(suffix, 'ReturnStatement', {}, { argument: value })

  const valueName = inputButtonGlobalName(index)
  const valueId = node('value', 'VariableDeclaration', { name: valueName, type: booleanType }, { initializer: boolean('valueStart', initial) })
  module.rootNodeIds.push(valueId)

  // L'accesseur `isPress()` est la surface importable du bouton depuis les autres modules.
  const parameterless = node('function:isPress', 'FunctionDeclaration', { name: 'isPress', type: booleanType }, {
    parameters: [],
    body: block('body:isPress', [returnValue('returnIsPress', ref('returnIsPressRef', valueName))]),
  })
  module.rootNodeIds.push(parameterless)
  module.exports.push({ nodeId: parameterless, name: 'isPress' })

  return {
    module,
    nodes,
    functions: { isPress: 'isPress', names: { value: valueName } },
  }
}
