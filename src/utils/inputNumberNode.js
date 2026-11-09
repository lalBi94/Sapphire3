import { createModule, createNode } from './logic/model.js'
import { inputNumberOnChangeName, inputNumberNoopName } from './logic/inputNumberState.js'

export { inputNumberOnChangeName, inputNumberNoopName } from './logic/inputNumberState.js'

export const inputNumberDefaults = Object.freeze({ value: 0 })
export const inputFloatDefaults = Object.freeze({ value: 0 })
export const inputStringDefaults = Object.freeze({ value: '' })

// Retourne la valeur initiale de présentation pour un type d'entrée.
export function inputValueDefaults(valueType) {
  return valueType === 'string' ? inputStringDefaults : valueType === 'float' ? inputFloatDefaults : inputNumberDefaults
}

const valueTypes = ['int', 'float', 'string']
const voidType = { kind: 'primitive', name: 'void' }

// Crée le module caché d'une entrée typée : une fonction `onChange(valeur)` liée par la carte.
export function createInputNumberModule(moduleId, name, index, options = {}) {
  const valueType = valueTypes.includes(options.valueType) ? options.valueType : 'int'
  const valuePrimitive = { kind: 'primitive', name: valueType }
  const callbackType = { kind: 'function', parameters: [valuePrimitive], returnType: voidType }
  const module = createModule(moduleId, name)
  module.inputNumber = { index, valueType }
  const nodes = []
  let sequence = 0
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `input-number:${moduleId}:${suffix}:${++sequence}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }
  const ref = (suffix, target) => node(suffix, 'Reference', {}, {}, { target: { kind: 'name', name: target } })
  const block = (suffix, statements) => node(suffix, 'Block', {}, { statements })

  const onChangeName = inputNumberOnChangeName(index)
  const noopName = inputNumberNoopName(index)

  // Fonction vide utilisée tant qu'aucune fonction n'est liée à l'entrée.
  const noopParameter = node('noop:value', 'Parameter', { name: 'value', type: valuePrimitive })
  const noop = node('function:noop', 'FunctionDeclaration', { name: noopName, type: voidType }, {
    parameters: [noopParameter],
    body: block('body:noop', []),
  })
  module.rootNodeIds.push(noop)

  // La carte remplace cette référence par la fonction choisie, dans le même module ou via un import.
  const onChange = node('onChange', 'VariableDeclaration', { name: onChangeName, type: callbackType }, {
    initializer: ref('onChangeStart', noopName),
  })
  module.rootNodeIds.push(onChange)

  return {
    module,
    nodes,
    functions: { onChange: onChangeName, noop: noopName, names: { onChange: onChangeName, noop: noopName } },
  }
}
