import { createModule, createNode } from './logic/model.js'
import { inputButtonOnClickName, inputButtonNoopName } from './logic/inputButtonState.js'

export { inputButtonGlobalName, inputButtonOnClickName, inputButtonNoopName } from './logic/inputButtonState.js'

export const inputButtonDefaults = Object.freeze({ pressed: false })

const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const callbackType = { kind: 'function', parameters: [booleanType], returnType: voidType }

// Crée le module caché d'un bouton : une fonction `onClick(bool)` liée par la carte.
export function createInputButtonModule(moduleId, name, index, options = {}) {
  const mode = options.mode === 'hold' ? 'hold' : 'toggle'
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
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })

  const onClickName = inputButtonOnClickName(index)
  const noopName = inputButtonNoopName(index)

  // Fonction vide utilisée tant qu'aucune fonction n'est liée au bouton.
  const noopParameter = node('noop:value', 'Parameter', { name: 'value', type: booleanType })
  const noop = node('function:noop', 'FunctionDeclaration', { name: noopName, type: voidType }, {
    parameters: [noopParameter],
    body: block('body:noop', []),
  })
  module.rootNodeIds.push(noop)

  // La carte remplace cette référence par la fonction choisie, dans le même module ou via un import.
  const onClick = node('onClick', 'VariableDeclaration', { name: onClickName, type: callbackType }, {
    initializer: ref('onClickStart', noopName),
  })
  module.rootNodeIds.push(onClick)

  return {
    module,
    nodes,
    functions: { onClick: onClickName, noop: noopName, names: { onClick: onClickName, noop: noopName } },
  }
}
